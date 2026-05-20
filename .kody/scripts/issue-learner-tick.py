#!/usr/bin/env python3
"""
issue-learner tick: scan recently closed issues and drop one sticky
note per issue not yet memorialised. Closed-completed → lesson,
closed-not-planned → decision. The memory-writer job files the
stickies on its next tick.

Dedup: presence of .kody/memory/issue-<n>.md or an inbox JSON for the
same issue number. No state file needed.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
INBOX_DIR = MEMORY_DIR / "inbox"

LOOKBACK_DAYS = int(os.environ.get("ISSUE_LEARNER_LOOKBACK_DAYS", "14"))
MAX_ISSUES = int(os.environ.get("ISSUE_LEARNER_MAX_ISSUES", "50"))
BODY_SNIPPET = 600

# Internal tracking issues we never memorialise — they would be noise.
SKIP_LABELS = {
    "kody:cto-decisions",
    "kody:ceo-proposal",
    "kody:system-audit",
    "kody:job-state",
    "kody:doc-drift",
    "kody:dead-code-sweep",
    "kody:deps-bump",
    "kody:type-debt",
    "kody:flaky-test",
    "kody:coverage-floor",
    "kody:security-audit",
    "kody:memorize",
}

# Heuristic: issue titles that scream "noise."
NOISE_TITLE_PREFIXES = (
    "kody system audit",
    "kody:",
)


def log(msg: str) -> None:
    print(f"[issue-learner] {msg}", file=sys.stderr)


def gh(args: list[str]) -> str:
    return subprocess.run(
        ["gh", *args],
        check=True,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    ).stdout


def already_memorialised(issue_number: int) -> bool:
    if (MEMORY_DIR / f"issue-{issue_number}.md").exists():
        return True
    needle = f'"name": "issue-{issue_number}"'
    for path in INBOX_DIR.glob("*.json"):
        try:
            if needle in path.read_text():
                return True
        except OSError:
            continue
    return False


def list_closed_issues(since_iso: str) -> list[dict]:
    raw = gh(
        [
            "issue",
            "list",
            "--state",
            "closed",
            "--limit",
            str(MAX_ISSUES),
            "--search",
            f"closed:>{since_iso}",
            "--json",
            "number,title,body,closedAt,author,url,labels,stateReason,closedByPullRequestsReferences",
        ]
    )
    try:
        return json.loads(raw or "[]")
    except json.JSONDecodeError as e:
        log(f"unable to parse issue list: {e}")
        return []


def normalise_body(body: str | None) -> str:
    if not body:
        return ""
    return body.strip().replace("\r\n", "\n")


def first_section(body: str) -> str:
    if not body:
        return ""
    chunks = [c.strip() for c in body.split("\n\n") if c.strip()]
    if not chunks:
        return ""
    snippet = chunks[0]
    if len(snippet) > BODY_SNIPPET:
        snippet = snippet[:BODY_SNIPPET].rstrip() + "…"
    return snippet


def label_names(issue: dict) -> set[str]:
    return {l.get("name", "") for l in issue.get("labels", []) or []}


def is_worth_remembering(issue: dict) -> bool:
    title = (issue.get("title") or "").strip().lower()
    if not title:
        return False
    if any(title.startswith(p) for p in NOISE_TITLE_PREFIXES):
        return False
    if SKIP_LABELS & label_names(issue):
        return False
    return True


def closing_prs(issue: dict) -> list[str]:
    refs = issue.get("closedByPullRequestsReferences") or []
    return [r.get("url", "") for r in refs if r.get("url")]


def build_sticky(issue: dict, ts: datetime) -> dict:
    n = issue["number"]
    title = issue.get("title", f"Issue #{n}")
    body = normalise_body(issue.get("body"))
    summary = first_section(body) or "(no issue body provided)"
    author_obj = issue.get("author") or {}
    author = author_obj.get("login", "unknown")
    closed_at = issue.get("closedAt", "")
    url = issue.get("url", "")
    state_reason = (issue.get("stateReason") or "").upper()
    prs = closing_prs(issue)

    sticky_type = "decision" if state_reason == "NOT_PLANNED" else "lesson"
    pr_line = (
        "\n**Closed by:** " + ", ".join(prs)
        if prs
        else ""
    )

    note_body = (
        f"**Issue:** [{url}]({url})\n"
        f"**Reporter:** @{author}\n"
        f"**Closed:** {closed_at} ({state_reason or 'COMPLETED'})"
        f"{pr_line}\n\n"
        "## Title\n"
        f"{title}\n\n"
        "## Summary (first section of issue body)\n"
        f"{summary}\n"
    )
    return {
        "type": sticky_type,
        "name": f"issue-{n}",
        "title": f"Issue #{n}: {title}",
        "hook": f"{title} — closed {closed_at[:10]} ({state_reason or 'COMPLETED'})",
        "body": note_body,
        "source": "job:issue-learner",
        "ts": ts.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "links": [],
    }


def filename_for(issue_number: int, ts: datetime) -> str:
    stamp = ts.strftime("%Y-%m-%dT%H-%M-%SZ")
    return f"{stamp}-issue-learner-issue{issue_number}-{uuid.uuid4().hex[:6]}.json"


def main() -> int:
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")

    issues = list_closed_issues(since)
    if not issues:
        log(f"no closed issues since {since}")
        return 0

    dropped = 0
    skipped_dup = 0
    skipped_low = 0
    for issue in issues:
        n = issue.get("number")
        if n is None:
            continue
        if already_memorialised(n):
            skipped_dup += 1
            continue
        if not is_worth_remembering(issue):
            skipped_low += 1
            continue
        sticky = build_sticky(issue, now)
        target = INBOX_DIR / filename_for(n, now)
        target.write_text(json.dumps(sticky, indent=2))
        log(
            f"dropped sticky for issue #{n} "
            f"({sticky['type']}): {issue.get('title', '')[:60]}"
        )
        dropped += 1

    log(
        f"tick complete: dropped {dropped}, dedup-skipped {skipped_dup}, "
        f"low-signal-skipped {skipped_low}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
