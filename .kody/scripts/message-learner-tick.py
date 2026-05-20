#!/usr/bin/env python3
"""
message-learner tick: scan dashboard message threads (channel-tagged
GitHub Discussions) and drop a sticky note for any comment that opts
into memory with `#remember`, `#lesson`, or `#decision` at the start
of its body.

Dedup: presence of `.kody/memory/msg-<databaseId>.md` or an inbox JSON
naming the same `msg-<databaseId>`. No state file needed.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
INBOX_DIR = MEMORY_DIR / "inbox"

LOOKBACK_DAYS = int(os.environ.get("MESSAGE_LEARNER_LOOKBACK_DAYS", "14"))
MAX_DISCUSSIONS = int(os.environ.get("MESSAGE_LEARNER_MAX_DISCUSSIONS", "30"))
MAX_COMMENTS_PER_DISC = int(os.environ.get("MESSAGE_LEARNER_MAX_COMMENTS_PER", "50"))

MARKERS = {
    "#remember": "preference",
    "#lesson": "lesson",
    "#decision": "decision",
}

SLUG_BANNED_RE = re.compile(r"[^a-z0-9]+")


def log(msg: str) -> None:
    print(f"[message-learner] {msg}", file=sys.stderr)


def gh_graphql(query: str, variables: dict) -> dict:
    proc = subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={query}"]
        + [f"-F{k}={v}" for k, v in variables.items()],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )
    if proc.returncode != 0:
        raise RuntimeError(f"graphql failed: {proc.stderr.strip()}")
    return json.loads(proc.stdout or "{}")


def repo_info() -> tuple[str, str]:
    proc = subprocess.run(
        ["gh", "repo", "view", "--json", "owner,name"],
        check=True,
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
    )
    data = json.loads(proc.stdout)
    return data["owner"]["login"], data["name"]


def list_channel_discussions(owner: str, repo: str) -> list[dict]:
    query = """
    query($owner: String!, $repo: String!, $limit: Int!) {
      repository(owner: $owner, name: $repo) {
        discussions(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            id
            number
            title
            updatedAt
          }
        }
      }
    }
    """
    data = gh_graphql(
        query, {"owner": owner, "repo": repo, "limit": MAX_DISCUSSIONS}
    )
    nodes = (
        data.get("data", {})
        .get("repository", {})
        .get("discussions", {})
        .get("nodes", [])
    )
    # Channels: titles starting with `#`
    return [d for d in nodes if d.get("title", "").startswith("#")]


def list_comments(owner: str, repo: str, number: int) -> list[dict]:
    query = """
    query($owner: String!, $repo: String!, $number: Int!, $limit: Int!) {
      repository(owner: $owner, name: $repo) {
        discussion(number: $number) {
          comments(last: $limit) {
            nodes {
              id
              databaseId
              body
              createdAt
              url
              author {
                login
              }
            }
          }
        }
      }
    }
    """
    data = gh_graphql(
        query,
        {
            "owner": owner,
            "repo": repo,
            "number": number,
            "limit": MAX_COMMENTS_PER_DISC,
        },
    )
    return (
        data.get("data", {})
        .get("repository", {})
        .get("discussion", {})
        .get("comments", {})
        .get("nodes", [])
    )


def parse_marker(body: str) -> tuple[str, str] | None:
    """Return (type, remainder) if body starts with a known marker."""
    stripped = body.lstrip()
    for marker, sticky_type in MARKERS.items():
        if stripped.lower().startswith(marker):
            remainder = stripped[len(marker):].lstrip(":").strip()
            if len(remainder) < 20:
                return None
            return sticky_type, remainder
    return None


def slug_from_remainder(remainder: str) -> str:
    words = remainder.split()[:6]
    slug = SLUG_BANNED_RE.sub("-", " ".join(words).lower()).strip("-")
    return (slug[:48] or "msg-untitled").rstrip("-")


def already_memorialised(database_id: int) -> bool:
    if (MEMORY_DIR / f"msg-{database_id}.md").exists():
        return True
    needle = f'"name": "msg-{database_id}"'
    for path in INBOX_DIR.glob("*.json"):
        try:
            if needle in path.read_text():
                return True
        except OSError:
            continue
    return False


def build_sticky(
    comment: dict,
    discussion: dict,
    sticky_type: str,
    remainder: str,
    ts: datetime,
) -> dict:
    database_id = comment["databaseId"]
    slug_tail = slug_from_remainder(remainder)
    name = f"msg-{database_id}-{slug_tail}"
    title_line = remainder.split("\n", 1)[0].strip()
    headline = (title_line[:80] + ("…" if len(title_line) > 80 else "")) or "Untagged"
    body = (
        f"**Source:** [dashboard message]({comment.get('url', '')})\n"
        f"**Channel:** {discussion.get('title', '?')}\n"
        f"**Author:** @{(comment.get('author') or {}).get('login', 'unknown')}\n"
        f"**Posted:** {comment.get('createdAt', '')}\n\n"
        f"{remainder}\n"
    )
    return {
        "type": sticky_type,
        "name": name,
        "title": f"Message: {headline}",
        "hook": f"{headline} (from {discussion.get('title', '?')})",
        "body": body,
        "source": "job:message-learner",
        "ts": ts.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "links": [],
    }


def filename_for(database_id: int, ts: datetime) -> str:
    stamp = ts.strftime("%Y-%m-%dT%H-%M-%SZ")
    return f"{stamp}-message-learner-msg{database_id}-{uuid.uuid4().hex[:6]}.json"


def main() -> int:
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    horizon = now - timedelta(days=LOOKBACK_DAYS)

    try:
        owner, repo = repo_info()
    except subprocess.CalledProcessError as e:
        log(f"repo lookup failed: {e}")
        return 1

    try:
        channels = list_channel_discussions(owner, repo)
    except RuntimeError as e:
        log(str(e))
        return 1

    if not channels:
        log("no channel discussions found (channels are # -prefixed titles)")
        return 0

    dropped = 0
    skipped_dup = 0
    skipped_no_marker = 0
    skipped_bot = 0
    for channel in channels:
        try:
            comments = list_comments(owner, repo, channel["number"])
        except RuntimeError as e:
            log(f"channel #{channel.get('number')} comments fetch failed: {e}")
            continue
        for comment in comments:
            created = comment.get("createdAt", "")
            try:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except ValueError:
                continue
            if created_dt < horizon:
                continue
            author = (comment.get("author") or {}).get("login", "")
            if author.endswith("[bot]") or author == "kody":
                skipped_bot += 1
                continue
            parsed = parse_marker(comment.get("body", ""))
            if parsed is None:
                skipped_no_marker += 1
                continue
            sticky_type, remainder = parsed
            database_id = comment.get("databaseId")
            if database_id is None:
                continue
            if already_memorialised(database_id):
                skipped_dup += 1
                continue
            sticky = build_sticky(comment, channel, sticky_type, remainder, now)
            target = INBOX_DIR / filename_for(database_id, now)
            target.write_text(json.dumps(sticky, indent=2))
            log(
                f"dropped sticky for msg #{database_id} "
                f"({sticky_type}) in {channel.get('title')}"
            )
            dropped += 1

    log(
        f"tick complete: dropped {dropped}, dedup-skipped {skipped_dup}, "
        f"no-marker-skipped {skipped_no_marker}, bot-skipped {skipped_bot}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
