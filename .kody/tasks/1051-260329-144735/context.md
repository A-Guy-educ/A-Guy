### taskify (2026-03-29T14:48:55)

Now I have enough context. Here's the task classification:

```json
{
  "task_type": "feature",
  "title": "Auto-populate lesson blocks from exercises and content pages",
  "description": "Implement automatic population of lesson blocks array based on exercise and content page lesson relationships. When an exercise or content page is created/published with a lesson reference, it should automatically appear in that lesson's blocks array at the end. When deleted or its lesson reference changes, re
...(truncated)

### plan (2026-03-29T14:50:38)
Now I have a complete picture. Here's the implementation plan:

---

# Implementation Plan: Auto-populate Lesson Blocks

## Overview

When an exercise or content page is created/updated/deleted with a lesson reference, automatically sync that lesson's `blocks` textarea (JSON array). Remove manual add/delete buttons from the admin UI. Include a one-time migration for existing data.

---

## Step 1: Create the shared sync-lesson-blocks hook utility

**File:** `src/server/payload/hooks/lessons/sync
...(truncated)

### build (2026-03-29T14:55:26)
All done. Here's a summary of what was implemented:

**New files:**
- `src/server/payload/hooks/lessons/syncLessonBlocks.ts` — shared utility with `addBlockToLesson` / `removeBlockFromLesson`. Appends new blocks at the end, uses `_skipBlockSync` context flag to prevent infinite loops.
- `src/server/payload/migrations/populateLessonBlocks.ts` — idempotent one-time migration that scans all exercises (sorted by `order`) and content pages (sorted by `createdAt`), then appends any missing blocks to e
...(truncated)

### review (2026-03-29T14:57:34)
Both requirements are already implemented:

1. **New blocks are inserted at the end** — `addBlockToLesson` uses `[...blocks, newBlock]` to append at the end, and the migration also appends missing blocks with `[...existingBlocks, ...toAdd]`.

2. **One-time migration runs on deployment** — `runPopulateLessonBlocksOnInit` is called in `payload.config.ts`'s `onInit` handler. It's idempotent (skips existing refs) and processes exercises sorted by `order`, then content pages sorted by `createdAt`.

T
...(truncated)
```
