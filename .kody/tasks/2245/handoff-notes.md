# Issue #2245 — Docs Drift: Exercises (#2109)

## Summary

Reviewed PR #2109 (`fix(lesson-blocks): Persist exercise deletions in lesson blocks UI`) to determine if `docs/exercises/README.md` needs updating.

## Investigation

PR #2109 made two changes:
1. **`afterChange` hooks** in `Exercises` and `ContentPages`: Changed from unconditionally calling `addBlockToLesson` on every update to only calling it when the lesson association changes (create or reassignment). This prevents re-appending deleted blocks on every exercise edit.
2. **`populateLessonBlocks` migration**: Skip lessons that already have a non-empty curated blocks array (was previously re-merging all exercises unconditionally).

The Exercises README documents the **data model** (minimal fields), **Zod validation**, **question types**, and **relationship to lessons**. None of these were changed by PR #2109.

The bug fix is purely **internal implementation** — the `afterChange` hook behavior, block sync mechanism, and migration logic are not documented in the README.

## Decision

**No doc update needed.** The change is doc-irrelevant. The README accurately describes the Exercises collection as implemented.

## Notes

- The doc file `docs/exercises/README.md` was read in full
- Grepped for `addBlockToLesson`, `populateLessonBlocks`, `afterChange` across all `docs/` — no references found
- No files were modified
