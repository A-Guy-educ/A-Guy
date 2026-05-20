---
every: 30m
worker: coo
---

# task-memory-extractor

## Job

Scan `.kody/tasks/*/memory-recs.json` files (written by executors at
task end per the AGENTS.md memory protocol). For each unprocessed
recommendation, decide whether it becomes a real memory:

- `confidence: high` → drop a sticky note in `.kody/memory/inbox/` so
  the memory-writer files it.
- `confidence: medium` → leave attached to the task for later inspection;
  do not promote to memory.
- `confidence: low` → ignore.

The recommendation stays in the task's `memory-recs.json` either way —
this job only decides what becomes a real memory file; it never edits
the task artifacts.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[task-memory-extractor-tick.py](.kody/scripts/task-memory-extractor-tick.py)
is the **single source of truth** for the filter, dedup, and sticky shape.

Run the script:

```
python3 .kody/scripts/task-memory-extractor-tick.py
```

The script:

1. Globs `.kody/tasks/*/memory-recs.json`.
2. For each task's recommendations:
   - Skip the entire file if the matching task has already been
     processed (marker: `.kody/tasks/<id>/.extracted` exists).
   - Otherwise, iterate the array, drop sticky notes only for
     `confidence: high` items that aren't already filed
     (`.kody/memory/<name>.md` or matching inbox sticky).
3. After processing a task, touch `.kody/tasks/<id>/.extracted`.
4. Logs counts and exits 0.

## Restrictions

- Never edit `.kody/tasks/*/memory-recs.json` — that's the task's
  artifact. Promoting a rec to memory is a separate signal (the inbox
  sticky note); the task record is the source of truth.
- Never write to `.kody/memory/*.md` directly — only drop sticky notes.
- The marker file `.extracted` is the dedup record; deleting it
  forces re-processing of that task.

## Scope

What this job remembers is **what the executor judged worth
remembering at task end**. It does not regenerate or re-evaluate
recommendations — that judgment belongs to the executor that ran the
task with full context.
