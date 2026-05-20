---
every: 15m
worker: coo
---

# memory-writer

## Job

Drain the sticky-note inbox at `.kody/memory/inbox/` and file each note into
the long-lived memory under `.kody/memory/`. Writers (chat sessions, task
executors, dashboard inbox verdicts) drop sticky notes; this job is the only
process that mutates the permanent memory files and `INDEX.md`. That keeps
parallel writers conflict-free — every writer creates its own uniquely-named
JSON file, and a single tick serializes the merges.

## Tick procedure — REQUIRED

This tick is **fully scripted**. The script
[memory-writer-tick.py](.kody/scripts/memory-writer-tick.py) is the **single
source of truth** for which sticky notes are filed, how each memory file is
formatted, how `INDEX.md` is updated, and which sticky notes are deleted.

Run the script:

```
python3 .kody/scripts/memory-writer-tick.py
```

The script:

1. Lists `.kody/memory/inbox/*.json`.
2. For each note: validates required fields (`type`, `name`, `body`),
   sanitises the slug, writes `.kody/memory/<name>.md` with frontmatter
   (`type`, `source`, `recorded_at`, optional `links`), and adds or replaces
   the matching line in `INDEX.md`.
3. Deletes processed sticky notes.
4. Commits and pushes the result if anything changed (suppress with
   `MEMORY_WRITER_NO_COMMIT=1` for dry runs).

If the script exits non-zero, surface its stderr in the tick narration and
**do not** attempt the same work in prose — let the next tick retry.

## Restrictions

- Never mutate `.kody/memory/*.md` or `INDEX.md` from prose. The script owns
  those files.
- Never delete a sticky note unless it has been filed successfully — the
  script handles this atomically per note.
- Reserved memory filenames are blocked by the script: `index`, `readme`,
  `inbox`. A sticky note that tries to overwrite them is skipped with a log
  line, not filed.
- Sticky notes with invalid JSON, missing fields, an unknown `type`, or a
  non-slug `name` are skipped (logged, left in place for inspection).

## State

This job is stateless on disk — its "memory" is the inbox folder itself
plus git history. No `*.state.json` companion is required.
