#!/usr/bin/env python3
"""
Memory-writer tick: drain .kody/memory/inbox/*.json → write .kody/memory/<name>.md,
update INDEX.md, delete processed sticky notes. One-writer-per-folder serialization
makes this safe under parallel sticky-note producers.

Exit code 0 means tick completed (with or without work). Non-zero means the tick
itself errored — the engine should surface this.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
INBOX_DIR = MEMORY_DIR / "inbox"
INDEX_PATH = MEMORY_DIR / "INDEX.md"

VALID_TYPES = {"preference", "decision", "lesson", "verdict", "architecture", "feedback"}
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
RESERVED_NAMES = {"index", "readme", "inbox"}


@dataclass
class Note:
    path: pathlib.Path
    type: str
    name: str
    title: str
    hook: str
    body: str
    source: str
    ts: str
    links: list[str]


def log(msg: str) -> None:
    print(f"[memory-writer] {msg}", file=sys.stderr)


def load_note(path: pathlib.Path) -> Note | None:
    try:
        raw = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        log(f"skip {path.name}: invalid JSON ({e})")
        return None

    missing = [k for k in ("type", "name", "body") if k not in raw]
    if missing:
        log(f"skip {path.name}: missing fields {missing}")
        return None

    ntype = raw["type"].strip().lower()
    if ntype not in VALID_TYPES:
        log(f"skip {path.name}: invalid type {ntype!r}")
        return None

    name = raw["name"].strip().lower()
    if name in RESERVED_NAMES or not SLUG_RE.match(name):
        log(f"skip {path.name}: invalid name {name!r} (reserved or non-slug)")
        return None

    return Note(
        path=path,
        type=ntype,
        name=name,
        title=raw.get("title", name.replace("-", " ").title()),
        hook=raw.get("hook", "(no hook provided)").strip(),
        body=raw["body"],
        source=raw.get("source", "unknown"),
        ts=raw.get("ts", ""),
        links=raw.get("links", []) or [],
    )


def write_memory_file(note: Note) -> pathlib.Path:
    target = MEMORY_DIR / f"{note.name}.md"
    links_yaml = ""
    if note.links:
        links_yaml = "links:\n" + "".join(f"  - {l}\n" for l in note.links)
    frontmatter = (
        "---\n"
        f"name: {note.name}\n"
        f"title: {note.title}\n"
        f"type: {note.type}\n"
        f"source: {note.source}\n"
        f"recorded_at: {note.ts}\n"
        f"{links_yaml}"
        "---\n\n"
    )
    target.write_text(frontmatter + note.body.rstrip() + "\n")
    return target


def update_index(note: Note) -> None:
    line = f"- [{note.title}]({note.name}.md) — {note.hook} (type: {note.type})"
    existing = INDEX_PATH.read_text().splitlines() if INDEX_PATH.exists() else []

    entry_marker = f"]({note.name}.md)"
    replaced = False
    out_lines: list[str] = []
    for raw in existing:
        if entry_marker in raw:
            out_lines.append(line)
            replaced = True
        else:
            out_lines.append(raw)
    if not replaced:
        if out_lines and out_lines[-1].strip():
            out_lines.append("")
        out_lines.append(line)

    INDEX_PATH.write_text("\n".join(out_lines).rstrip() + "\n")


def git(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(REPO_ROOT), *args], check=check, capture_output=True, text=True)


def git_commit_and_push(summary: str) -> bool:
    # Stage every change under .kody/memory/ — covers new memory files,
    # the INDEX.md edit, and the (already-unlinked) inbox sticky notes.
    add_result = git(["add", "-A", "--", ".kody/memory/"], check=False)
    if add_result.returncode != 0:
        log(f"git add failed: {add_result.stderr.strip()}")
        return False

    status = git(["status", "--porcelain", "--", ".kody/memory/"], check=False).stdout.strip()
    if not status:
        return False

    commit_result = git(["commit", "-m", summary], check=False)
    if commit_result.returncode != 0:
        log(f"git commit failed: {commit_result.stderr.strip()}")
        return False

    push_result = git(["push", "origin", "HEAD"], check=False)
    if push_result.returncode != 0:
        log(f"git push failed: {push_result.stderr.strip()}")
        return False
    return True


def main() -> int:
    if not INBOX_DIR.exists():
        log("inbox dir missing — nothing to do")
        return 0

    notes_files = sorted(INBOX_DIR.glob("*.json"))
    if not notes_files:
        log("inbox empty")
        return 0

    processed: list[Note] = []
    skipped = 0
    for path in notes_files:
        note = load_note(path)
        if note is None:
            skipped += 1
            continue
        write_memory_file(note)
        update_index(note)
        path.unlink()
        processed.append(note)
        log(f"filed {note.name}.md (type={note.type}, source={note.source})")

    if not processed:
        log(f"tick complete: 0 filed, {skipped} skipped")
        return 0

    summary_lines = [
        f"chore(memory): file {len(processed)} sticky note(s)",
        "",
    ] + [f"- {n.name} ({n.type}, from {n.source})" for n in processed]
    summary = "\n".join(summary_lines)

    if os.environ.get("MEMORY_WRITER_NO_COMMIT") == "1":
        log(f"tick complete: {len(processed)} filed, {skipped} skipped (commit suppressed)")
        return 0

    committed = git_commit_and_push(summary)
    if committed:
        log(f"tick complete: {len(processed)} filed, {skipped} skipped, committed + pushed")
    else:
        log(f"tick complete: {len(processed)} filed, {skipped} skipped, no commit made")
    return 0


if __name__ == "__main__":
    sys.exit(main())
