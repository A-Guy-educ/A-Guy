#!/usr/bin/env python3
"""
task-memory-extractor tick: read each task's memory-recs.json (written
by the executor at task end per AGENTS.md protocol), promote
high-confidence recommendations to inbox stickies. Marker-based dedup
prevents re-processing the same task.

Exit 0 on success (including no work). Non-zero only on hard error.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import uuid
from datetime import datetime, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
TASKS_DIR = REPO_ROOT / ".kody" / "tasks"
MEMORY_DIR = REPO_ROOT / ".kody" / "memory"
INBOX_DIR = MEMORY_DIR / "inbox"

VALID_TYPES = {"preference", "decision", "lesson"}
VALID_CONFIDENCE = {"high", "medium", "low"}


def log(msg: str) -> None:
    print(f"[task-memory-extractor] {msg}", file=sys.stderr)


def already_filed(rec_name: str) -> bool:
    if (MEMORY_DIR / f"{rec_name}.md").exists():
        return True
    needle = f'"name": "{rec_name}"'
    for path in INBOX_DIR.glob("*.json"):
        try:
            if needle in path.read_text():
                return True
        except OSError:
            continue
    return False


def build_sticky(rec: dict, task_id: str, ts: datetime) -> dict:
    body_lines: list[str] = []
    explicit_body = (rec.get("body") or "").rstrip()
    if explicit_body:
        body_lines.append(explicit_body)
    why = rec.get("why")
    how = rec.get("how_to_apply")
    if why:
        body_lines.append(f"\n**Why:** {why}")
    if how:
        body_lines.append(f"**How to apply:** {how}")
    body_lines.append(f"\n**Source task:** `{task_id}`")
    body = "\n".join(body_lines).strip() + "\n"

    # Hook defaults to the title's first line, or the why if no title.
    hook = (
        rec.get("hook")
        or (rec.get("title") or "").split("\n", 1)[0]
        or (rec.get("why") or "")[:100]
        or "(no hook provided)"
    )
    return {
        "type": rec["type"],
        "name": rec["name"],
        "title": rec.get("title", rec["name"].replace("-", " ").title()),
        "hook": hook,
        "body": body,
        "source": f"job:task-memory-extractor:from-{task_id}",
        "ts": ts.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "links": rec.get("links", []),
    }


def is_valid(rec: dict) -> str | None:
    for key in ("type", "name"):
        if key not in rec or not rec[key]:
            return f"missing field {key!r}"
    # body is preferred but optional — we can compose one from why +
    # how_to_apply when the executor LLM only emits those shorter fields.
    has_text = bool(rec.get("body")) or bool(rec.get("why")) or bool(rec.get("how_to_apply"))
    if not has_text:
        return "missing body / why / how_to_apply (no source text)"
    if rec["type"] not in VALID_TYPES:
        return f"invalid type {rec['type']!r}"
    conf = rec.get("confidence", "").lower()
    if conf and conf not in VALID_CONFIDENCE:
        return f"invalid confidence {conf!r}"
    return None


def filename_for(task_id: str, rec_name: str, ts: datetime) -> str:
    stamp = ts.strftime("%Y-%m-%dT%H-%M-%SZ")
    return f"{stamp}-task-mem-{task_id}-{rec_name}-{uuid.uuid4().hex[:6]}.json"


def main() -> int:
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    if not TASKS_DIR.exists():
        log("no .kody/tasks/ — nothing to extract")
        return 0

    now = datetime.now(timezone.utc)
    tasks_seen = 0
    tasks_skipped_done = 0
    dropped = 0
    skipped_low = 0
    skipped_medium = 0
    skipped_dup = 0
    skipped_invalid = 0

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

            confidence = (rec.get("confidence") or "low").lower()
            if confidence == "low":
                skipped_low += 1
                continue
            if confidence == "medium":
                skipped_medium += 1
                continue
            # confidence high
            if already_filed(rec["name"]):
                skipped_dup += 1
                continue

            sticky = build_sticky(rec, task_dir.name, now)
            target = INBOX_DIR / filename_for(task_dir.name, rec["name"], now)
            target.write_text(json.dumps(sticky, indent=2))
            log(f"task {task_dir.name}: promoted '{rec['name']}' to inbox")
            dropped += 1

        (task_dir / ".extracted").touch()

    log(
        f"tick complete: tasks_seen={tasks_seen} skipped_done={tasks_skipped_done} "
        f"promoted={dropped} skipped_medium={skipped_medium} "
        f"skipped_low={skipped_low} dup-skipped={skipped_dup} "
        f"invalid-skipped={skipped_invalid}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
