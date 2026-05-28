#!/usr/bin/env python3
"""
pr-health-triage tick (deterministic). Replaces the prose-driven job-tick:
the LLM proved unreliable at emitting the mandatory kody-job-next-state
block across a heavy multi-PR tick, silently dropping the dedup ledger.

This script is the single source of truth for one tick:
  1. Read prior state (.kody/jobs/pr-health-triage.state.json).
  2. Read the trust ledger (kody:cto-decisions issue) → per-verb mode.
  3. Enumerate open non-draft PRs.
  4. Detect at most one repair per PR (priority: resolve > fix-ci > sync).
  5. Dedup by fingerprint "<verb>|<updatedAt>"; act only on new fingerprints.
  6. Graduated verb → auto-dispatch (no mention); else → recommend (@operator).
  7. Print a summary table + a kody-job-next-state fenced block.

It NEVER commits: the engine's configured backend (contents-api) persists
the emitted state. It only posts `gh pr comment`s and prints to stdout.

Exit 0 on a normal tick (including "nothing to do"). Non-zero only on hard
failures (no gh, malformed ledger that we choose to surface, etc.).
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
from datetime import datetime, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
STATE_PATH = REPO_ROOT / ".kody" / "jobs" / "pr-health-triage.state.json"
KODY_CONFIG_PATH = REPO_ROOT / "kody.config.json"

DECISIONS_LABEL = "kody:cto-decisions"
LEDGER_START = "<!-- kody-cto-decisions:start -->"
LEDGER_END = "<!-- kody-cto-decisions:end -->"
VERBS = ("fix-ci", "sync", "resolve")

# Cap how many PRs we act on per tick. Without this, a wave of stale PRs all
# fire at once (the 25-sync flood). Lowest PR numbers first; the rest are
# picked up on subsequent ticks.
MAX_ACTIONS_PER_TICK = 5

# CI conclusions that count as failing (STARTUP_FAILURE treated like FAILURE).
FAIL_CONCLUSIONS = {"FAILURE", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"}
RUNNING_STATUSES = {"IN_PROGRESS", "QUEUED"}
STALE_THRESHOLD = 10  # behind_by must exceed this to warrant a sync.


def log(msg: str) -> None:
    """Diagnostics go to stderr so stdout stays the clean state contract."""
    sys.stderr.write(f"[pr-health-triage] {msg}\n")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def gh(args: list[str], check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["gh", *args], check=check, capture_output=True, text=True, cwd=str(REPO_ROOT)
    )


def repo_slug() -> str:
    """owner/repo from kody.config.json (falls back to GITHUB_REPOSITORY)."""
    try:
        cfg = json.loads(KODY_CONFIG_PATH.read_text(encoding="utf-8"))
        gh_cfg = cfg.get("github", {})
        owner, repo = gh_cfg.get("owner"), gh_cfg.get("repo")
        if owner and repo:
            return f"{owner}/{repo}"
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return os.environ.get("GITHUB_REPOSITORY", "")


def operator_handle() -> str | None:
    """github.operator from kody.config.json — the @-mention target. None if
    absent so recommendations still post (without inbox routing)."""
    try:
        cfg = json.loads(KODY_CONFIG_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    op = cfg.get("github", {}).get("operator")
    return op if isinstance(op, str) and op else None


def load_state() -> dict:
    """Prior state envelope; seed shape on first tick or any parse failure."""
    if not STATE_PATH.exists():
        return {"cursor": "idle", "data": {"prs": {}}, "done": False}
    try:
        env = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        log("prior state unreadable — seeding fresh")
        return {"cursor": "idle", "data": {"prs": {}}, "done": False}
    env.setdefault("data", {}).setdefault("prs", {})
    return env


def read_ledger_modes() -> dict[str, str]:
    """Per-verb mode from the lowest-numbered kody:cto-decisions issue.
    Anything other than an explicit "auto" → "ask" (fail safe)."""
    modes = {v: "ask" for v in VERBS}
    res = gh(
        ["issue", "list", "--state", "open", "--label", DECISIONS_LABEL,
         "--limit", "5", "--json", "number,body"]
    )
    if res.returncode != 0:
        log(f"ledger read failed (treating all verbs as ask): {res.stderr.strip()}")
        return modes
    try:
        issues = json.loads(res.stdout or "[]")
    except json.JSONDecodeError:
        return modes
    if not issues:
        return modes
    lowest = min(issues, key=lambda i: i.get("number", 1 << 30))
    body = lowest.get("body", "") or ""
    if LEDGER_START not in body or LEDGER_END not in body:
        return modes
    inner = body.split(LEDGER_START, 1)[1].split(LEDGER_END, 1)[0]
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", inner, re.DOTALL)
    if not m:
        return modes
    try:
        ledger = json.loads(m.group(1))
    except json.JSONDecodeError:
        log("ledger JSON malformed — treating all verbs as ask")
        return modes
    # Trust is tracked per staff slug: staff.<slug>.<verb>.mode. This job runs
    # as the CTO, so read the CTO's slice. (The old flat "actions.<verb>" path
    # silently read nothing once the ledger moved to per-staff, pinning every
    # verb to "ask" forever even after graduation.)
    cto = ledger.get("staff", {}).get("cto", {})
    for v in VERBS:
        if cto.get(v, {}).get("mode") == "auto":
            modes[v] = "auto"
    return modes


def ci_failing(rollup: object) -> bool:
    """True when at least one check failed and none are still running."""
    if not isinstance(rollup, list):
        return False
    has_fail = any(
        isinstance(c, dict) and c.get("conclusion") in FAIL_CONCLUSIONS for c in rollup
    )
    any_running = any(
        isinstance(c, dict) and c.get("status") in RUNNING_STATUSES for c in rollup
    )
    return has_fail and not any_running


def behind_by(slug: str, base: str, head: str) -> int:
    res = gh(["api", f"repos/{slug}/compare/{base}...{head}", "--jq", ".behind_by"])
    if res.returncode != 0:
        return 0
    try:
        return int((res.stdout or "0").strip())
    except ValueError:
        return 0


def detect_repair(pr: dict, slug: str) -> tuple[str, str] | None:
    """Return (verb, reason) for the highest-priority repair, or None."""
    base = pr.get("baseRefName", "")
    head = pr.get("headRefName", "")
    if pr.get("mergeable") == "CONFLICTING":
        return "resolve", f"PR #{pr['number']} has merge conflicts with `{base}`."
    if ci_failing(pr.get("statusCheckRollup")):
        return "fix-ci", f"PR #{pr['number']} has failing CI checks."
    drift = behind_by(slug, base, head)
    if drift > STALE_THRESHOLD:
        return "sync", f"PR #{pr['number']}'s branch is {drift} commits behind `{base}`."
    return None


DRY_RUN = os.environ.get("KODY_DRY_RUN") == "1"


def post_comment(pr_number: int, body: str) -> bool:
    if DRY_RUN:
        log(f"[dry-run] would comment on #{pr_number}: {body.splitlines()[0]}")
        return True
    res = gh(["pr", "comment", str(pr_number), "--body", body])
    if res.returncode != 0:
        log(f"comment failed on #{pr_number}: {res.stderr.strip()}")
        return False
    return True


def recommend(pr_number: int, verb: str, reason: str, operator: str | None) -> bool:
    mention = f"@{operator} " if operator else ""
    body = (
        f"{mention}🧭 **CTO recommendation** — `{verb}`\n\n"
        f"{reason} Confirming will run `@kody {verb} --pr {pr_number}`.\n\n"
        f"<!-- kody-cmd: @kody {verb} --pr {pr_number} -->\n\n"
        "_Confirm or dismiss this in the dashboard inbox. The CTO will not act on its own._"
    )
    return post_comment(pr_number, body)


def auto_run(pr_number: int, verb: str, reason: str) -> bool:
    """Dispatch comment + a silent, mention-free audit comment."""
    if not post_comment(pr_number, f"@kody {verb} --pr {pr_number}"):
        return False
    audit = (
        f"🧭 **CTO auto-ran** — `{verb}`\n\n"
        f"Ran `@kody {verb} --pr {pr_number}` ({reason}). Graduated: operator "
        f"approved `{verb}` repeatedly. A **Reject** on any `{verb}` returns me to asking."
    )
    return post_comment(pr_number, audit)


def emit_state(prs_state: dict) -> None:
    envelope = {"cursor": "idle", "data": {"prs": prs_state}, "done": False}
    print("\n```kody-job-next-state")
    print(json.dumps(envelope, indent=2))
    print("```")


def main() -> int:
    slug = repo_slug()
    if not slug:
        log("could not resolve owner/repo — aborting")
        return 1

    state = load_state()
    prior_prs: dict = state.get("data", {}).get("prs", {})
    operator = operator_handle()
    modes = read_ledger_modes()

    res = gh(
        ["pr", "list", "--state", "open", "--limit", "100", "--json",
         "number,title,headRefName,headRefOid,baseRefName,isDraft,mergeable,statusCheckRollup,updatedAt"]
    )
    if res.returncode != 0:
        log(f"pr list failed: {res.stderr.strip()}")
        return 1
    try:
        prs = json.loads(res.stdout or "[]")
    except json.JSONDecodeError:
        log("pr list returned invalid JSON")
        return 1

    open_numbers = {str(pr["number"]) for pr in prs}
    # Prune ledger entries for PRs no longer open.
    new_prs = {k: v for k, v in prior_prs.items() if k in open_numbers}

    print("| PR | verb | fingerprint | action | note |")
    print("|----|------|-------------|--------|------|")

    actions_taken = 0
    # Lowest PR number first → deterministic, fair ordering under the cap.
    for pr in sorted(prs, key=lambda p: p["number"]):
        num = pr["number"]
        key = str(num)
        if pr.get("isDraft"):
            print(f"| #{num} | — | — | skip | draft |")
            continue

        repair = detect_repair(pr, slug)
        if repair is None:
            print(f"| #{num} | — | — | skip | healthy |")
            continue
        verb, reason = repair
        # Fingerprint on the branch head SHA, not updatedAt. Posting our own
        # `@kody <verb>` comment bumps updatedAt, so an updatedAt-based fp made
        # every acted-on PR look "new" next tick and re-fire forever — a handful
        # of zombie PRs then ate the whole per-tick cap and starved the queue.
        # headRefOid only moves when the branch actually changes (incl. a
        # successful sync), which is exactly when a repair should re-evaluate.
        fp = f"{verb}|{pr.get('headRefOid', '')}"
        prior = new_prs.get(key)
        graduated = modes.get(verb) == "auto"
        intended_stage = f"{verb}-auto" if graduated else f"{verb}-recommended"

        # Dedup on the branch head SHA *and* the action we'd take. Keying on fp
        # alone pinned a PR that was recommended before its verb graduated at
        # "-recommended" forever (unchanged branch → unchanged fp), so it never
        # upgraded to an auto-run. Re-fire when the intended action changes;
        # still honour an operator "dismissed".
        if prior and prior.get("fp") == fp and prior.get("stage") in (intended_stage, "dismissed"):
            print(f"| #{num} | {verb} | {fp[:24]} | skip | dedup (unchanged) |")
            continue

        if actions_taken >= MAX_ACTIONS_PER_TICK:
            print(f"| #{num} | {verb} | {fp[:24]} | defer | per-tick cap ({MAX_ACTIONS_PER_TICK}) |")
            continue

        if graduated:
            ok = auto_run(num, verb, reason)
            stage = f"{verb}-auto"
            action = "auto-ran" if ok else "auto-failed"
        else:
            ok = recommend(num, verb, reason, operator)
            stage = f"{verb}-recommended"
            action = "recommended" if ok else "recommend-failed"

        if ok:
            actions_taken += 1
            new_prs[key] = {"fp": fp, "stage": stage, "lastActAt": now_iso()}
        print(f"| #{num} | {verb} | {fp[:24]} | {action} | {'auto' if graduated else 'advisory'} |")

    log(f"tick complete: {actions_taken} action(s), {len(new_prs)} tracked PR(s)")
    emit_state(new_prs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
