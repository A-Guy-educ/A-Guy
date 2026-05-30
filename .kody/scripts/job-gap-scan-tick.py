#!/usr/bin/env python3
"""
job-gap-scan tick: once a day, propose ONE new high-ROI duty the system
does not yet have. Reads .kody/memory/ to honour prior verdicts, picks
the highest-ROI candidate from a built-in catalogue, and overwrites
`.kody/reports/job-gap-scan.md`. Never writes new duty markdown
directly — that is for the operator to approve.

Cadence is engine-enforced via `every:` in the duty markdown. The
JOB_GAP_SCAN_FORCE=1 env var is accepted for parity with prior
behaviour but does nothing now (no in-script cadence guard).

Exit 0 always (cadence skips and "nothing eligible" are normal). Non-zero
only on hard failures (state file unwritable, etc.).
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
JOBS_DIR = REPO_ROOT / ".kody" / "jobs"
DUTIES_DIR = REPO_ROOT / ".kody" / "duties"
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
REPORTS_DIR = REPO_ROOT / ".kody" / "reports"
STATE_PATH = JOBS_DIR / "job-gap-scan.state.json"
REPORT_PATH = REPORTS_DIR / "job-gap-scan.md"

DISMISS_COOLOFF_DAYS = 30

VERDICT_FILE_RE = re.compile(r"^verdict-ceo-proposal-(?P<slug>[a-z0-9-]+)\.md$")
FRONTMATTER_RE = re.compile(r"^---\s*$(.*?)^---\s*$", re.MULTILINE | re.DOTALL)


@dataclass
class Candidate:
    slug: str
    title: str
    headline: str
    why_now: str
    risk: str
    effort: str
    value: str
    roi: int
    duty_markdown: str


CATALOGUE: list[Candidate] = [
    Candidate(
        slug="sentry-digest",
        title="Sentry top-errors digest",
        headline="Daily digest of the loudest unresolved Sentry errors so production noise becomes a triage list, not a chase.",
        why_now="The repo already ships with Sentry. Errors visible only in the Sentry UI are invisible to kody — turning them into issues closes the loop.",
        risk="low",
        effort="low",
        value="high",
        roi=95,
        duty_markdown="""---
every: 24h
staff: kody
---

# sentry-digest

## Job

Once a day, fetch the top 10 unresolved Sentry errors ranked by
`events × users_affected` and open one GitHub issue per recurring error
that has no open tracking issue yet.

## Tick procedure — REQUIRED

Fully scripted. See [sentry-digest-tick.py](.kody/scripts/sentry-digest-tick.py).
""",
    ),
    Candidate(
        slug="stale-pr-janitor",
        title="Stale-PR janitor",
        headline="Comment on PRs idle >14 days, close at 30 days — frees the operator from manual bench cleanup.",
        why_now="PRs left dangling rot review etiquette; an explicit timeout makes it the bot's job, not the human's.",
        risk="low",
        effort="low",
        value="medium",
        roi=80,
        duty_markdown="""---
every: 24h
staff: kody
---

# stale-pr-janitor

## Job

Comment a single nudge on PRs idle >14 days; close (with comment) at 30
days. Skip drafts and any PR carrying a `kody:*` lifecycle label.
""",
    ),
    Candidate(
        slug="issue-auto-triage",
        title="Issue auto-triage",
        headline="Label new issues by content (`type:bug/feat/docs`, `area:*`) so the inbox is sorted without operator effort.",
        why_now="Triage today is manual or absent — most projects pay this tax forever; one duty zeroes it out.",
        risk="low",
        effort="low",
        value="medium",
        roi=78,
        duty_markdown="""---
on:
  issues:
    types: [opened]
staff: kody
---

# issue-auto-triage

## Job

When a new issue is opened, infer labels from title+body and apply
them. Never close or assign — labels only.
""",
    ),
    Candidate(
        slug="secret-leak-scan",
        title="Secret-leak scan",
        headline="Schedule gitleaks daily and open one tracking issue on any finding — a cheap defensive layer.",
        why_now="Once a secret is in git history, removal is expensive — early detection is the only affordable insurance.",
        risk="low",
        effort="low",
        value="high",
        roi=85,
        duty_markdown="""---
every: 24h
staff: kody
---

# secret-leak-scan

## Job

Run `gitleaks detect` daily against the full history. Open one issue
per finding type, with the offending file+line redacted.
""",
    ),
    Candidate(
        slug="bundle-size-diff",
        title="Bundle-size diff",
        headline="Comment per-PR on first-load JS delta; fail the PR if regression >5%.",
        why_now="A Next.js bundle quietly grows by KBs per commit. Visibility on PRs is the only reliable defence.",
        risk="low",
        effort="medium",
        value="medium",
        roi=70,
        duty_markdown="""---
on:
  pull_request:
    types: [opened, synchronize]
staff: kody
---

# bundle-size-diff

## Job

On every PR push, run `next build`, compare `.next/`-reported first-load
JS bytes against base branch, and comment the delta. Fail the check if
>5% regression on any route.
""",
    ),
]


def log(msg: str) -> None:
    print(f"[job-gap-scan] {msg}", file=sys.stderr)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(ts: datetime) -> str:
    return ts.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except json.JSONDecodeError:
            log("state file unreadable, starting fresh")
            return {}
    return {}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n")


def read_verdicts() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not MEMORY_DIR.exists():
        return out
    for path in MEMORY_DIR.glob("verdict-ceo-proposal-*.md"):
        m = VERDICT_FILE_RE.match(path.name)
        if not m:
            continue
        slug = m.group("slug")
        text = path.read_text()
        fm = FRONTMATTER_RE.search(text)
        meta: dict[str, str] = {}
        if fm:
            for line in fm.group(1).splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
        source = meta.get("source", "")
        decision = source.rsplit(":", 1)[-1] if ":" in source else ""
        prev = out.get(slug)
        if prev is None or (meta.get("recorded_at", "") > prev.get("recorded_at", "")):
            out[slug] = {"decision": decision, "recorded_at": meta.get("recorded_at", "")}
    return out


def existing_duty_slugs() -> set[str]:
    if not DUTIES_DIR.exists():
        return set()
    return {p.stem for p in DUTIES_DIR.glob("*.md")}


def render_current(cand: Candidate, now: datetime) -> str:
    score_row = (
        f"| 1 | {cand.title} | {cand.risk} | {cand.effort} | {cand.value} | {cand.roi} |"
    )
    return (
        "## Current proposal\n\n"
        f"**{cand.slug}** — {cand.headline}\n\n"
        "### Why now\n\n"
        f"{cand.why_now}\n\n"
        "### Scoring\n\n"
        "| # | Item | Risk | Effort | Value | ROI |\n"
        "|---|------|------|--------|-------|-----|\n"
        f"{score_row}\n\n"
        "### Draft duty markdown\n\n"
        "If approved, the operator (or an executor) would commit the following at "
        f"`.kody/duties/{cand.slug}.md`. This is a starting point, not a final spec.\n\n"
        "````markdown\n"
        f"{cand.duty_markdown.rstrip()}\n"
        "````\n\n"
        "### Verdict path\n\n"
        "Approve → create the duty markdown above. Reject → permanent — the CEO will "
        "not surface this slug again. Dismiss → cooling-off for 30 days, then "
        "eligible to re-surface if signal grows.\n"
    )


def render_caught_up() -> str:
    return (
        "## Current proposal\n\n"
        "_All catalogue candidates have either been adopted (found in "
        "`.kody/duties/`), rejected, or dismissed within the cool-off window. "
        "Nothing new to suggest this cycle._\n"
    )


def render_history(state: dict[str, Any], verdicts: dict[str, dict[str, Any]]) -> str:
    proposed = state.get("proposed", {})
    if not proposed:
        return "## History\n\n_No prior proposals yet._\n"
    by_slug = {c.slug: c for c in CATALOGUE}
    rows = []
    for slug, meta in sorted(
        proposed.items(),
        key=lambda kv: kv[1].get("firstSuggestedISO", ""),
        reverse=True,
    ):
        title = by_slug[slug].title if slug in by_slug else slug
        first = (meta.get("firstSuggestedISO") or "")[:10]
        v = verdicts.get(slug)
        if v and v.get("decision"):
            status = v["decision"]
        elif slug in existing_duty_slugs():
            status = "adopted"
        else:
            status = "pending"
        rows.append(f"| {slug} | {title} | {first} | {status} |")
    return (
        "## History\n\n"
        "| Slug | Title | First suggested | Status |\n"
        "|------|-------|-----------------|--------|\n"
        + "\n".join(rows)
        + "\n"
    )


def write_report(body: str) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(body)


def commit_and_push(slug: str | None) -> bool:
    paths = [
        str(STATE_PATH.relative_to(REPO_ROOT)),
        str(REPORT_PATH.relative_to(REPO_ROOT)),
    ]
    add_result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "add", "--", *paths],
        capture_output=True,
        text=True,
    )
    if add_result.returncode != 0:
        log(f"git add failed: {add_result.stderr.strip()}")
        return False
    status = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "status", "--porcelain", "--", *paths],
        capture_output=True,
        text=True,
    ).stdout.strip()
    if not status:
        return False
    subject_tail = f"propose {slug}" if slug else "no eligible proposals"
    subject = f"chore(duties): Refresh job-gap-scan report ({subject_tail})"
    body = (
        f"Overwrites `.kody/reports/job-gap-scan.md` and bumps "
        f"`.kody/jobs/job-gap-scan.state.json`. Advisory only — the operator "
        f"decides Approve/Reject/Dismiss."
    )
    commit_result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "commit", "-m", subject, "-m", body],
        capture_output=True,
        text=True,
    )
    if commit_result.returncode != 0:
        log(f"git commit failed: {commit_result.stderr.strip()}")
        return False
    push_result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "push", "origin", "HEAD"],
        capture_output=True,
        text=True,
    )
    if push_result.returncode != 0:
        log(f"git push failed: {push_result.stderr.strip()}")
        return False
    return True


def main() -> int:
    state = load_state()
    state.setdefault("proposed", {})

    verdicts = read_verdicts()
    existing = existing_duty_slugs()
    now = now_utc()

    eligible: list[Candidate] = []
    for cand in CATALOGUE:
        if cand.slug in existing:
            log(f"skip {cand.slug}: already in .kody/duties/")
            continue
        verdict = verdicts.get(cand.slug)
        if verdict:
            decision = verdict.get("decision", "")
            if decision == "reject":
                log(f"skip {cand.slug}: rejected (permanent)")
                continue
            if decision == "dismiss":
                recorded = parse_iso(verdict.get("recorded_at"))
                if recorded and (now - recorded) < timedelta(days=DISMISS_COOLOFF_DAYS):
                    log(f"skip {cand.slug}: dismissed within cooling-off window")
                    continue
        eligible.append(cand)

    chosen: Candidate | None = None
    if eligible:
        eligible.sort(key=lambda c: c.roi, reverse=True)
        chosen = eligible[0]
        log(f"chose {chosen.slug} (roi={chosen.roi})")
        existing_meta = state["proposed"].get(chosen.slug, {})
        first = existing_meta.get("firstSuggestedISO") or iso(now)
        state["proposed"][chosen.slug] = {
            "firstSuggestedISO": first,
            "lastWrittenISO": iso(now),
        }
    else:
        log("no eligible proposals")

    state["lastRunISO"] = iso(now)
    save_state(state)

    current_section = render_current(chosen, now) if chosen else render_caught_up()
    history_section = render_history(state, verdicts)
    report = (
        "# Job Gap Scan\n\n"
        "_Cadence: daily — one proposed duty per cycle, advisory only._\n\n"
        f"_Last updated: {iso(now)}_\n\n"
        f"{current_section}\n"
        f"{history_section}"
    )
    write_report(report)

    if os.environ.get("JOB_GAP_SCAN_NO_COMMIT") == "1":
        log("tick complete (commit suppressed)")
        return 0

    committed = commit_and_push(chosen.slug if chosen else None)
    if committed:
        log("tick complete: report + state committed")
    else:
        log("tick complete: nothing to commit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
