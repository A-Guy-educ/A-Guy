#!/usr/bin/env python3
"""
job-gap-scan tick: once a week, propose ONE new high-ROI job the system
does not yet have. Reads .kody/memory/ to honour prior verdicts, picks
the highest-ROI candidate from a built-in catalogue, and opens a GitHub
issue labeled `kody:ceo-proposal`. Never writes new job markdown
directly — that is for the operator to approve.

Cadence: skip unless ≥6 days since last run. Override with
JOB_GAP_SCAN_FORCE=1 for live tests.

Exit 0 always (cadence skips and "nothing eligible" are normal). Non-zero
only on hard failures (gh missing, state file unwritable, etc.).
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
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
STATE_PATH = JOBS_DIR / "job-gap-scan.state.json"

PROPOSAL_LABEL = "kody:ceo-proposal"
CADENCE_DAYS = 0  # Engine schedules via every: 24h in the job markdown.
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
    job_markdown: str


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
        job_markdown="""---
every: 24h
worker: kody
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
        job_markdown="""---
every: 24h
worker: kody
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
        why_now="Triage today is manual or absent — most projects pay this tax forever; one job zeroes it out.",
        risk="low",
        effort="low",
        value="medium",
        roi=78,
        job_markdown="""---
on:
  issues:
    types: [opened]
worker: kody
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
        job_markdown="""---
every: 24h
worker: kody
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
        job_markdown="""---
on:
  pull_request:
    types: [opened, synchronize]
worker: kody
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
            log(f"state file unreadable, starting fresh")
            return {}
    return {}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n")


def cadence_skip(state: dict[str, Any]) -> bool:
    if os.environ.get("JOB_GAP_SCAN_FORCE") == "1":
        return False
    if CADENCE_DAYS <= 0:
        return False  # Engine handles cadence via every: <interval> in job markdown.
    last = parse_iso(state.get("lastRunISO"))
    if last is None:
        return False
    return now_utc() - last < timedelta(days=CADENCE_DAYS)


def read_verdicts() -> dict[str, dict[str, Any]]:
    """Map slug → latest verdict frontmatter (type/source/recorded_at + decision parsed from name)."""
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
        if ":" in source:
            decision = source.rsplit(":", 1)[-1]
        else:
            decision = ""
        prev = out.get(slug)
        if prev is None or (meta.get("recorded_at", "") > prev.get("recorded_at", "")):
            out[slug] = {"decision": decision, "recorded_at": meta.get("recorded_at", "")}
    return out


def existing_job_slugs() -> set[str]:
    if not JOBS_DIR.exists():
        return set()
    return {p.stem for p in JOBS_DIR.glob("*.md")}


def gh(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["gh", *args],
        check=check,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )


def existing_proposal_issue(slug: str) -> int | None:
    title = f"ceo: propose new job — {slug}"
    result = gh(
        [
            "issue",
            "list",
            "--label",
            PROPOSAL_LABEL,
            "--state",
            "open",
            "--search",
            f'in:title "{title}"',
            "--json",
            "number,title",
            "--limit",
            "20",
        ],
        check=False,
    )
    if result.returncode != 0:
        log(f"gh issue list failed (label may not exist yet): {result.stderr.strip()}")
        return None
    try:
        items = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return None
    for item in items:
        if item.get("title") == title:
            return int(item["number"])
    return None


def ensure_label() -> None:
    check = gh(
        ["label", "list", "--search", PROPOSAL_LABEL, "--json", "name", "--limit", "5"],
        check=False,
    )
    if check.returncode == 0 and PROPOSAL_LABEL in check.stdout:
        return
    create = gh(
        [
            "label",
            "create",
            PROPOSAL_LABEL,
            "--description",
            "Kody CEO: proposed new job (advisory, awaiting operator decision)",
            "--color",
            "0e8a16",
        ],
        check=False,
    )
    if create.returncode != 0:
        log(f"label create returned: {create.stderr.strip()}")


def build_issue_body(cand: Candidate) -> str:
    score_row = (
        f"| 1 | {cand.title} | {cand.risk} | {cand.effort} | {cand.value} | {cand.roi} |"
    )
    return (
        f"{cand.headline}\n\n"
        "## Why now\n\n"
        f"{cand.why_now}\n\n"
        "## Scoring\n\n"
        "| # | Item | Risk | Effort | Value | ROI |\n"
        "|---|---|---|---|---|---|\n"
        f"{score_row}\n\n"
        "## Draft job markdown\n\n"
        "If approved, the operator (or an executor) would commit the following at "
        f"`.kody/jobs/{cand.slug}.md`. This is a starting point, not a final spec.\n\n"
        "````markdown\n"
        f"{cand.job_markdown.rstrip()}\n"
        "````\n\n"
        "## Verdict path\n\n"
        "Approve → create the job markdown above (manually or via a follow-up "
        "task). Reject → permanent — the CEO will not surface this slug again. "
        "Dismiss → cooling-off for 30 days, then eligible to re-surface if signal "
        "grows.\n"
    )


def create_proposal_issue(cand: Candidate) -> int | None:
    title = f"ceo: propose new job — {cand.slug}"
    body = build_issue_body(cand)
    ensure_label()
    result = gh(
        [
            "issue",
            "create",
            "--title",
            title,
            "--label",
            PROPOSAL_LABEL,
            "--body",
            body,
        ],
        check=False,
    )
    if result.returncode != 0:
        log(f"issue create failed: {result.stderr.strip()}")
        return None
    # `gh issue create` prints the URL on stdout; extract the number.
    url = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
    m = re.search(r"/issues/(\d+)$", url)
    return int(m.group(1)) if m else None


def commit_state(slug: str) -> bool:
    add_result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "add", "--", str(STATE_PATH.relative_to(REPO_ROOT))],
        capture_output=True,
        text=True,
    )
    if add_result.returncode != 0:
        log(f"git add failed: {add_result.stderr.strip()}")
        return False
    status = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "status", "--porcelain", "--", str(STATE_PATH.relative_to(REPO_ROOT))],
        capture_output=True,
        text=True,
    ).stdout.strip()
    if not status:
        return False
    msg = f"chore(jobs): job-gap-scan proposed {slug}"
    commit_result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "commit", "-m", msg],
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

    if cadence_skip(state):
        log("cadence guard: <6 days since last run, skipping (override with JOB_GAP_SCAN_FORCE=1)")
        return 0

    verdicts = read_verdicts()
    existing_jobs = existing_job_slugs()
    now = now_utc()

    eligible: list[Candidate] = []
    for cand in CATALOGUE:
        if cand.slug in existing_jobs:
            log(f"skip {cand.slug}: already in .kody/jobs/")
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
        existing_issue = existing_proposal_issue(cand.slug)
        if existing_issue is not None:
            log(f"skip {cand.slug}: open proposal issue #{existing_issue} still pending")
            continue
        eligible.append(cand)

    if not eligible:
        log("no eligible proposals — exiting clean")
        return 0

    eligible.sort(key=lambda c: c.roi, reverse=True)
    chosen = eligible[0]
    log(f"chose {chosen.slug} (roi={chosen.roi})")

    issue_number = create_proposal_issue(chosen)
    if issue_number is None:
        log("issue create returned no number; not updating state")
        return 1

    state["lastRunISO"] = iso(now)
    state["proposed"][chosen.slug] = {
        "firstSuggestedISO": iso(now),
        "openIssue": issue_number,
    }
    save_state(state)

    if os.environ.get("JOB_GAP_SCAN_NO_COMMIT") == "1":
        log(f"tick complete: proposed {chosen.slug} as issue #{issue_number} (commit suppressed)")
        return 0

    committed = commit_state(chosen.slug)
    if committed:
        log(f"tick complete: proposed {chosen.slug} as issue #{issue_number}, state committed")
    else:
        log(f"tick complete: proposed {chosen.slug} as issue #{issue_number}, state NOT committed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
