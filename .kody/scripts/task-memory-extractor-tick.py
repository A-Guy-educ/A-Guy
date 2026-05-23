#!/usr/bin/env python3
"""
task-memory-extractor tick: read each task's memory-recs.json (written
by the executor at task end per AGENTS.md protocol), and file
high-confidence recommendations DIRECTLY into .kody/memory/<name>.md.
No inbox, no sticky notes, no second job — one step from
recommendation to memory.

Confidence rules:
  - high   → write the memory file, add an INDEX.md line
  - medium → leave attached to the task (.kody/tasks/<id>/memory-recs.json)
             for later inspection; do not promote to memory
  - low    → ignore

Dedup: presence of .kody/memory/<rec-name>.md skips the rec. Marker
file .kody/tasks/<id>/.extracted is the per-task processed flag.

Exit 0 on success (including no work). Non-zero only on hard error.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
from datetime import datetime, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
TASKS_DIR = REPO_ROOT / ".kody" / "tasks"
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
INDEX_PATH = MEMORY_DIR / "INDEX.md"

VALID_TYPES = {"preference", "decision", "lesson"}
VALID_CONFIDENCE = {"high", "medium", "low"}
RESERVED_NAMES = {"index", "readme"}


def log(msg: str) -> None:
    print(f"[task-memory-extractor] {msg}", file=sys.stderr)


def normalise_confidence(raw) -> str:
    """Accept either a string enum or a 0-1 number — LLMs emit both shapes."""
    if isinstance(raw, bool):  # avoid bool being treated as int
        return "low"
    if isinstance(raw, (int, float)):
        if raw >= 0.7:
            return "high"
        if raw >= 0.4:
            return "medium"
        return "low"
    if isinstance(raw, str):
        return raw.strip().lower() or "low"
    return "low"


def is_valid(rec: dict) -> str | None:
    for key in ("type", "name"):
        if key not in rec or not rec[key]:
            return f"missing field {key!r}"
    has_text = bool(rec.get("body")) or bool(rec.get("why")) or bool(rec.get("how_to_apply"))
    if not has_text:
        return "missing body / why / how_to_apply (no source text)"
    if rec["type"] not in VALID_TYPES:
        return f"invalid type {rec['type']!r}"
    if rec["name"].lower() in RESERVED_NAMES:
        return f"reserved name {rec['name']!r}"
    conf = normalise_confidence(rec.get("confidence"))
    if conf not in VALID_CONFIDENCE:
        return f"invalid confidence {rec.get('confidence')!r}"
    return None


def build_frontmatter(rec: dict, task_id: str, ts: datetime) -> str:
    name = rec["name"]
    title = rec.get("title") or name.replace("-", " ").title()
    return (
        "---\n"
        f"name: {name}\n"
        f"title: {title}\n"
        f"type: {rec['type']}\n"
        f"source: task:{task_id}\n"
        f"recorded_at: {ts.replace(microsecond=0).isoformat().replace('+00:00', 'Z')}\n"
        "---\n\n"
    )


def build_body(rec: dict, task_id: str) -> str:
    parts: list[str] = []
    explicit = (rec.get("body") or "").rstrip()
    if explicit:
        parts.append(explicit)
    if rec.get("why"):
        parts.append(f"\n**Why:** {rec['why']}")
    if rec.get("how_to_apply"):
        parts.append(f"**How to apply:** {rec['how_to_apply']}")
    parts.append(f"\n**Source task:** `{task_id}`")
    return "\n".join(parts).strip() + "\n"


def update_index(rec: dict, memory_filename: str) -> None:
    hook = (
        rec.get("hook")
        or (rec.get("title") or "").split("\n", 1)[0]
        or (rec.get("why") or "")[:120]
        or "(no hook)"
    )
    title = rec.get("title") or rec["name"].replace("-", " ").title()
    line = f"- [{title}]({memory_filename}) — {hook} (type: {rec['type']})"
    existing = INDEX_PATH.read_text().splitlines() if INDEX_PATH.exists() else []

    entry_marker = f"]({memory_filename})"
    out: list[str] = []
    replaced = False
    for raw in existing:
        if entry_marker in raw:
            out.append(line)
            replaced = True
        else:
            out.append(raw)
    if not replaced:
        if out and out[-1].strip():
            out.append("")
        out.append(line)
    INDEX_PATH.write_text("\n".join(out).rstrip() + "\n")


def write_memory(rec: dict, task_id: str, ts: datetime) -> pathlib.Path:
    target = MEMORY_DIR / f"{rec['name']}.md"
    target.write_text(build_frontmatter(rec, task_id, ts) + build_body(rec, task_id))
    update_index(rec, f"{rec['name']}.md")
    return target


def git(args: list[str], check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(REPO_ROOT), *args], check=check, capture_output=True, text=True)


def commit_and_push(summary: str) -> bool:
    add = git(["add", "-A", "--", ".kody/memory/", ".kody/tasks/"])
    if add.returncode != 0:
        log(f"git add failed: {add.stderr.strip()}")
        return False
    status = git(["status", "--porcelain", "--", ".kody/memory/", ".kody/tasks/"]).stdout.strip()
    if not status:
        return False
    commit = git(["commit", "-m", summary])
    if commit.returncode != 0:
        log(f"git commit failed: {commit.stderr.strip()}")
        return False
    push = git(["push", "origin", "HEAD"])
    if push.returncode != 0:
        log(f"git push failed: {push.stderr.strip()}")
        return False
    return True


def main() -> int:
    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    if not TASKS_DIR.exists():
        log("no .kody/tasks/ — nothing to extract")
        return 0

    now = datetime.now(timezone.utc)
    tasks_seen = 0
    tasks_skipped_done = 0
    written = 0
    skipped_low = 0
    skipped_medium = 0
    skipped_dup = 0
    skipped_invalid = 0
    written_recs: list[tuple[str, str]] = []  # (task_id, rec_name)

    for task_dir in sorted(TASKS_DIR.iterdir()):
        if not task_dir.is_dir():
            continue
        recs_path = task_dir / "memory-recs.json"
        if not recs_path.exists():
            continue
        tasks_seen += 1
        if (task_dir / ".extracted").exists():
            tasks_skipped_done += 1
            continue

        try:
            recs = json.loads(recs_path.read_text() or "[]")
        except json.JSONDecodeError as e:
            log(f"task {task_dir.name}: invalid JSON ({e})")
            (task_dir / ".extracted").touch()
            continue

        if not isinstance(recs, list):
            log(f"task {task_dir.name}: memory-recs.json must be a JSON array")
            (task_dir / ".extracted").touch()
            continue

        for rec in recs:
            if not isinstance(rec, dict):
                skipped_invalid += 1
                continue
            err = is_valid(rec)
            if err:
                log(f"task {task_dir.name}: skip rec ({err})")
                skipped_invalid += 1
                continue
            confidence = normalise_confidence(rec.get("confidence"))
            if confidence == "low":
                skipped_low += 1
                continue
            if confidence == "medium":
                skipped_medium += 1
                continue
            if (MEMORY_DIR / f"{rec['name']}.md").exists():
                skipped_dup += 1
                continue
            write_memory(rec, task_dir.name, now)
            log(f"task {task_dir.name}: wrote .kody/memory/{rec['name']}.md")
            written += 1
            written_recs.append((task_dir.name, rec["name"]))

        (task_dir / ".extracted").touch()

    log(
        f"tick complete: tasks_seen={tasks_seen} skipped_done={tasks_skipped_done} "
        f"written={written} skipped_medium={skipped_medium} "
        f"skipped_low={skipped_low} dup-skipped={skipped_dup} "
        f"invalid-skipped={skipped_invalid}"
    )

    if not written_recs:
        return 0
    if os.environ.get("TASK_MEMORY_EXTRACTOR_NO_COMMIT") == "1":
        log("commit suppressed by env")
        return 0

    summary_lines = [f"chore(memory): file {len(written_recs)} task lesson(s)", ""]
    for task_id, rec_name in written_recs:
        summary_lines.append(f"- {rec_name} (from task {task_id})")
    summary = "\n".join(summary_lines)

    committed = commit_and_push(summary)
    if committed:
        log(f"committed + pushed {len(written_recs)} new memory file(s)")
    else:
        log("no commit made (nothing changed or git error logged above)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
