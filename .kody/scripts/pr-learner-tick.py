#!/usr/bin/env python3
"""
pr-learner tick: scan recently merged PRs and drop one decision sticky
note per PR that hasn't been memorialised yet. The memory-writer job
files the stickies on its next tick.

Dedup: a PR is considered memorialised if .kody/memory/pr-<n>.md exists
OR if any inbox JSON contains `"name": "pr-<n>"`. No state file needed.

Exit 0 on success (including no work). Non-zero on hard error.
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

LOOKBACK_DAYS = int(os.environ.get("PR_LEARNER_LOOKBACK_DAYS", "14"))
MAX_PRS = int(os.environ.get("PR_LEARNER_MAX_PRS", "50"))
BODY_SNIPPET = 600


def log(msg: str) -> None:
    print(f"[pr-learner] {msg}", file=sys.stderr)


def gh(args: list[str]) -> str:
    return subprocess.run(
        ["gh", *args],
        check=True,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    ).stdout


def already_memorialised(pr_number: int) -> bool:
    if (MEMORY_DIR / f"pr-{pr_number}.md").exists():
        return True
    needle = f'"name": "pr-{pr_number}"'
    for path in INBOX_DIR.glob("*.json"):
        try:
            if needle in path.read_text():
                return True
        except OSError:
            continue
    return False


def list_merged_prs(since_iso: str) -> list[dict]:
    raw = gh(
        [
            "pr",
            "list",
            "--state",
            "merged",
            "--limit",
            str(MAX_PRS),
            "--search",
            f"merged:>{since_iso}",
            "--json",
            "number,title,body,mergedAt,author,url",
        ]
    )
    try:
        return json.loads(raw or "[]")
    except json.JSONDecodeError as e:
        log(f"unable to parse PR list: {e}")
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


def is_worth_remembering(title: str, body: str) -> bool:
    if not title:
        return False
    skip_prefixes = ("chore(deps):", "chore(release):", "Bump ", "dependabot")
    if any(title.lower().startswith(p.lower()) for p in skip_prefixes):
        return False
    return True


def build_sticky(pr: dict, ts: datetime) -> dict:
    pr_number = pr["number"]
    title = pr.get("title", f"PR #{pr_number}")
    body = normalise_body(pr.get("body"))
    summary = first_section(body) or "(no PR body provided)"
    author_obj = pr.get("author") or {}
    author = author_obj.get("login", "unknown")
    merged_at = pr.get("mergedAt", "")
    url = pr.get("url", "")

    note_body = (
        f"**PR:** [{url}]({url})\n"
        f"**Author:** @{author}\n"
        f"**Merged:** {merged_at}\n\n"
        "## Title\n"
        f"{title}\n\n"
        "## Summary (first section of PR body)\n"
        f"{summary}\n"
    )
    return {
        "type": "decision",
        "name": f"pr-{pr_number}",
        "title": f"PR #{pr_number}: {title}",
        "hook": f"{title} — merged {merged_at[:10]} by @{author}",
        "body": note_body,
        "source": "job:pr-learner",
        "ts": ts.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "links": [],
    }


def filename_for(pr_number: int, ts: datetime) -> str:
    stamp = ts.strftime("%Y-%m-%dT%H-%M-%SZ")
    return f"{stamp}-pr-learner-pr{pr_number}-{uuid.uuid4().hex[:6]}.json"


def main() -> int:
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")

    prs = list_merged_prs(since)
    if not prs:
        log(f"no merged PRs since {since}")
        return 0

    dropped = 0
    skipped_dup = 0
    skipped_low_signal = 0
    for pr in prs:
        pr_number = pr.get("number")
        if pr_number is None:
            continue
        if already_memorialised(pr_number):
            skipped_dup += 1
            continue
        if not is_worth_remembering(
            pr.get("title", ""), normalise_body(pr.get("body"))
        ):
            skipped_low_signal += 1
            continue
        sticky = build_sticky(pr, now)
        target = INBOX_DIR / filename_for(pr_number, now)
        target.write_text(json.dumps(sticky, indent=2))
        log(f"dropped sticky for PR #{pr_number}: {pr.get('title', '')[:60]}")
        dropped += 1

    log(
        f"tick complete: dropped {dropped}, dedup-skipped {skipped_dup}, "
        f"low-signal-skipped {skipped_low_signal}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
