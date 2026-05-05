#!/usr/bin/env python3
"""
Deterministic tick for the redispatch mission.

Replaces the prior LLM-driven enumeration that crashed with `error_max_turns`
on most ticks (the agent was scanning ~30 open issues, fetching each one's
comment history, parsing kody state blocks, and deciding actions in a single
turn-bounded session). All of those are deterministic operations — this script
does the whole tick and emits the kody-mission-next-state block on stdout.

The mission's agent runs `python3 .kody/scripts/redispatch-tick.py` and
emits the script's stdout verbatim. Agent budget: a few turns.

Honors the redispatch.md flags:
- DRY_RUN: when True, no comments posted, no labels added — every actionable
  candidate gets a dryRunLog entry instead.
- LIVE_TEST_LABEL gate: when DRY_RUN is False, only act on issues that carry
  the gate label. The flag still records all candidates while DRY_RUN is on.

Reads/writes `.kody/missions/redispatch.state.json` (read only here — the
engine's contents-API state backend persists the emitted next-state block).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

# --- config (mirrors flags in redispatch.md) ---
DRY_RUN = True
LIVE_TEST_LABEL = "kody:test-redispatch"
EXCLUDE_LABELS = {"kody:stuck", "kody:no-redispatch", "kody:stalled"}

# --- constants ---
STATE_FILE = ".kody/missions/redispatch.state.json"
DRYRUN_LOG_CAP = 50
FORTY_MIN_SECS = 40 * 60

# --- helpers ---
NOW = datetime.now(timezone.utc)
NOW_ISO = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
NOW_UTC_DAY = NOW.strftime("%Y-%m-%d")


def gh_json(args: list[str]) -> object:
    """Run gh and parse JSON stdout. Returns [] on empty body."""
    out = subprocess.check_output(["gh"] + args, text=True)
    if not out.strip():
        return []
    return json.loads(out)


def parse_iso(s: str) -> datetime:
    """Parse an ISO-8601 timestamp, normalizing 'Z' suffix."""
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s).astimezone(timezone.utc)


def age_seconds(ts_iso: str) -> float:
    return (NOW - parse_iso(ts_iso)).total_seconds()


def load_prior_state() -> tuple[dict, list]:
    """Read prior perIssue + dryRunLog. Returns ({}, []) if missing."""
    if not os.path.exists(STATE_FILE):
        return {}, []
    with open(STATE_FILE, encoding="utf-8") as f:
        env = json.load(f)
    data = env.get("data", {}) or {}
    return data.get("perIssue") or {}, list(data.get("dryRunLog") or [])


# --- kody state-block parsing ---
STATE_BLOCK_RE = re.compile(
    r"<!--\s*kody:state:v1:begin\s*-->(.*?)<!--\s*kody:state:v1:end\s*-->",
    re.DOTALL,
)
JSON_FENCE_RE = re.compile(r"```json\s*(.*?)```", re.DOTALL)


def extract_state_json(body: str) -> dict | None:
    """Pull the kody state JSON out of a comment/issue body, or None."""
    m = STATE_BLOCK_RE.search(body or "")
    if not m:
        return None
    inner = m.group(1)
    fence = JSON_FENCE_RE.search(inner)
    raw = fence.group(1) if fence else inner
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def latest_history_ts(state: dict) -> str | None:
    """Most-recent history timestamp, or core.lastOutcome.timestamp fallback."""
    history = (state.get("core") or {}).get("history") or state.get("history") or []
    timestamps: list[str] = []
    for h in history:
        ts = h.get("timestamp") if isinstance(h, dict) else None
        if isinstance(ts, str):
            timestamps.append(ts)
    if timestamps:
        return max(timestamps)
    last_outcome = ((state.get("core") or {}).get("lastOutcome") or {}).get("timestamp")
    return last_outcome if isinstance(last_outcome, str) else None


# --- per-issue checks ---
def find_latest_state_block(owner_repo: str, issue_num: int, body: str) -> dict | None:
    """Latest kody state block from issue body or comments (most recent wins)."""
    candidates: list[tuple[str, dict]] = []
    s = extract_state_json(body)
    if s:
        candidates.append(("0000-01-01T00:00:00Z", s))
    comments = gh_json(["api", f"repos/{owner_repo}/issues/{issue_num}/comments?per_page=100"])
    for c in comments or []:
        if not isinstance(c, dict):
            continue
        s = extract_state_json(c.get("body") or "")
        if s:
            candidates.append((c.get("created_at") or "", s))
    if not candidates:
        return None
    candidates.sort(key=lambda p: p[0], reverse=True)
    return candidates[0][1]


def has_fresh_kody_comment(owner_repo: str, issue_num: int) -> bool:
    """Any kody-authored or @kody-prefix comment newer than 40 minutes."""
    comments = gh_json(["api", f"repos/{owner_repo}/issues/{issue_num}/comments?per_page=100"])
    for c in (comments or [])[-30:]:
        if not isinstance(c, dict):
            continue
        body = (c.get("body") or "").strip()
        login = ((c.get("user") or {}).get("login") or "").lower()
        is_kody = login.endswith("[bot]") or "kody" in login or body.startswith("@kody") or body.startswith("⚙️ kody") or body.startswith("✅ kody")
        if not is_kody:
            continue
        ts = c.get("created_at")
        if isinstance(ts, str) and age_seconds(ts) < FORTY_MIN_SECS:
            return True
    return False


def has_open_kody_pr(state: dict) -> tuple[bool, str | None]:
    """If state.core.prUrl points to an open PR, return (True, pr_url)."""
    pr_url = ((state.get("core") or {}).get("prUrl")) or ""
    if not pr_url:
        return False, None
    m = re.search(r"/pull/(\d+)", pr_url)
    if not m:
        return False, pr_url
    pr_num = int(m.group(1))
    try:
        owner_repo = subprocess.check_output(
            ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], text=True
        ).strip()
        pr = gh_json(["api", f"repos/{owner_repo}/pulls/{pr_num}"])
        if isinstance(pr, dict) and pr.get("state") == "open":
            return True, pr_url
    except subprocess.CalledProcessError:
        pass
    return False, pr_url


def has_in_flight_workflow(owner_repo: str, issue_num: int) -> bool:
    """Active workflow_runs whose title or branch references the issue number."""
    runs = gh_json([
        "api",
        f"repos/{owner_repo}/actions/runs?status=in_progress&per_page=30",
    ])
    if not isinstance(runs, dict):
        return False
    needle = f"#{issue_num}"
    branch_needle = f"{issue_num}--"
    for r in runs.get("workflow_runs") or []:
        title = (r.get("display_title") or "") + " " + (r.get("name") or "")
        head = r.get("head_branch") or ""
        if needle in title or branch_needle in head or f"-{issue_num}-" in head:
            return True
    return False


# --- main tick ---
def main() -> int:
    owner_repo = subprocess.check_output(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], text=True
    ).strip()

    prior_per_issue, prior_dry_log = load_prior_state()

    # Reset attemptsToday for entries from prior UTC days.
    new_per_issue: dict[str, dict] = {}
    for k, v in prior_per_issue.items():
        if not isinstance(v, dict):
            continue
        last = v.get("lastResumedAt") or ""
        if last[:10] != NOW_UTC_DAY:
            v = {**v, "attemptsToday": 0}
        new_per_issue[k] = v

    issues = gh_json([
        "issue", "list",
        "--state", "open",
        "--limit", "200",
        "--json", "number,labels,updatedAt,body",
    ]) or []

    rows: list[dict] = []
    new_dry_entries: list[dict] = []
    actions: list[dict] = []  # records what we'd do (or did, if not dry-run)

    for issue in issues:
        if not isinstance(issue, dict):
            continue
        n = issue["number"]
        labels = {(lab.get("name") or "") for lab in (issue.get("labels") or [])}
        skip_reason = None

        if labels & EXCLUDE_LABELS:
            skip_reason = f"excluded by label: {sorted(labels & EXCLUDE_LABELS)}"

        state = None
        history_ts = None
        if not skip_reason:
            state = find_latest_state_block(owner_repo, n, issue.get("body") or "")
            if state is None:
                skip_reason = "no kody state block"
            else:
                core = state.get("core") or {}
                if core.get("status") != "running":
                    skip_reason = f"core.status={core.get('status')!r} (not 'running')"
                else:
                    history_ts = latest_history_ts(state)
                    if not history_ts:
                        skip_reason = "no history timestamp in state"
                    elif age_seconds(history_ts) < FORTY_MIN_SECS:
                        mins = int(age_seconds(history_ts) / 60)
                        skip_reason = f"history fresh ({mins}min < 40min threshold)"

        if not skip_reason:
            ok, pr_url = has_open_kody_pr(state or {})
            if ok:
                skip_reason = f"open kody PR linked: {pr_url}"

        if not skip_reason and has_in_flight_workflow(owner_repo, n):
            skip_reason = "in-flight workflow_run references this issue"

        if not skip_reason and has_fresh_kody_comment(owner_repo, n):
            skip_reason = "fresh kody comment (<40min)"

        # Decide action
        prior = new_per_issue.get(str(n)) or {}
        attempts_today = int(prior.get("attemptsToday") or 0)

        if skip_reason:
            row = {"issue": n, "action": "skip", "reason": skip_reason, "history_ts": history_ts}
            rows.append(row)
            continue

        # Real candidate. Decide resume or mark-stuck.
        last_resumed_history = prior.get("lastResumedHistoryTimestamp")
        if attempts_today >= 1:
            if last_resumed_history == history_ts:
                action = "mark-stuck"
                reason = (
                    f"attemptsToday={attempts_today}, history did not advance after prior resume "
                    f"(still at {history_ts})"
                )
            else:
                # State already moved; let it run, no-op skip.
                rows.append({
                    "issue": n,
                    "action": "skip",
                    "reason": f"already resumed today; state advanced ({last_resumed_history} → {history_ts}) — letting run",
                    "history_ts": history_ts,
                })
                continue
        else:
            action = "resume"
            reason = f"core.status=running, history age >40min ({history_ts}), no blockers"

        # Live-test gate: when DRY_RUN is off, only act on gate-labeled issues.
        gate_blocked = (not DRY_RUN) and (LIVE_TEST_LABEL not in labels)
        if gate_blocked:
            rows.append({
                "issue": n,
                "action": "skip",
                "reason": f"live-test gate: missing label {LIVE_TEST_LABEL!r}",
                "history_ts": history_ts,
            })
            continue

        rows.append({"issue": n, "action": action, "reason": reason, "history_ts": history_ts})
        actions.append({"issue": n, "action": action, "reason": reason, "history_ts": history_ts})

    # Apply state mutations + side effects
    new_dry_log = list(prior_dry_log)
    for a in actions:
        n = a["issue"]
        if DRY_RUN:
            new_dry_log.append({
                "issueNumber": n,
                "action": a["action"],
                "reason": a["reason"],
                "plannedAt": NOW_ISO,
            })
        else:
            try:
                if a["action"] == "resume":
                    subprocess.check_call(["gh", "issue", "comment", str(n), "--body", "@kody resume"])
                elif a["action"] == "mark-stuck":
                    subprocess.check_call(["gh", "issue", "comment", str(n), "--body",
                                           "kody resume did not advance state — needs human"])
                    subprocess.check_call(["gh", "issue", "edit", str(n), "--add-label", "kody:stuck"])
            except subprocess.CalledProcessError as e:
                rows.append({"issue": n, "action": "error", "reason": f"comment/label failed: {e}", "history_ts": a["history_ts"]})
                continue

            entry = new_per_issue.get(str(n)) or {}
            if a["action"] == "resume":
                new_per_issue[str(n)] = {
                    "lastResumedAt": NOW_ISO,
                    "lastResumedHistoryTimestamp": a["history_ts"] or "",
                    "attemptsToday": int(entry.get("attemptsToday") or 0) + 1,
                    "stuck": False,
                }
            elif a["action"] == "mark-stuck":
                new_per_issue[str(n)] = {**entry, "stuck": True}

    # Cap dryRunLog
    new_dry_log = new_dry_log[-DRYRUN_LOG_CAP:]

    # GC perIssue: drop entries whose issue isn't open + running anymore.
    open_nums = {str(i.get("number")) for i in issues if isinstance(i, dict)}
    new_per_issue = {k: v for k, v in new_per_issue.items() if k in open_nums}

    # --- emit human-readable summary table ---
    print(f"[redispatch] now={NOW_ISO} dry_run={DRY_RUN} candidates={len(rows)}")
    print()
    print("| issue | action | history_ts | reason |")
    print("|---|---|---|---|")
    for r in sorted(rows, key=lambda x: x["issue"]):
        ts = (r.get("history_ts") or "—")[:19]
        reason = (r["reason"] or "")[:120].replace("|", "\\|")
        print(f"| #{r['issue']} | {r['action']} | {ts} | {reason} |")

    print(f"\nactions taken this tick: {len(actions)}")
    for a in actions:
        verb = "logged (dry-run)" if DRY_RUN else "executed"
        print(f"  - #{a['issue']} {a['action']} — {verb}")

    # --- emit kody-mission-next-state block ---
    next_state = {
        "cursor": f"redispatch-{NOW_ISO}",
        "data": {
            "perIssue": new_per_issue,
            "dryRunLog": new_dry_log,
        },
        "done": False,
    }
    print()
    print("```kody-mission-next-state")
    print(json.dumps(next_state, indent=2))
    print("```")
    return 0


if __name__ == "__main__":
    sys.exit(main())
