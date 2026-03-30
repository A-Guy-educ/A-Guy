Now I have a complete picture. Here's the implementation plan:

---

# Implementation Plan: Auto-populate Lesson Blocks

## Overview

When an exercise or content page is created/updated/deleted with a lesson reference, automatically sync that lesson's `blocks` textarea (JSON array). Remove manual add/delete buttons from the admin UI. Include a one-time migration for existing data.

---

## Step 1: Create the shared sync-lesson-blocks hook utility

**File:** `src/server/payload/hooks/lessons/syncLessonBlocks.ts` (new)
**Change:** Create a utility that adds/removes a block entry in a lesson's `blocks` JSON textarea. This will be used by both Exercises and ContentPages afterChange/afterDelete hooks.

**Why:** Both collections need identical logic — extract to a shared helper to avoid duplication.

**Code:**

```typescript
/**
 * @fileType utility
 * @domain lessons
 * @pattern hook-helper
 * @ai-summary Syncs lesson blocks array when exercises/content pages change
 */

import type { Payload, PayloadRequest } from 'payload'

interface BlockEntry {
  id: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string
  contentPage?: string
}

/** Parse the blocks textarea field (JSON string or array) into a typed array */
function parseBlocks(raw: unknown): BlockEntry[] {
  if (Array.isArray(raw)) return raw as BlockEntry[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockEntry[]
    } catch {
      // ignore
    }
  }
  return []
}

/** Serialize blocks array back to JSON string for the textarea field */
function serializeBlocks(blocks: BlockEntry[]): string {
  return JSON.stringify(blocks)
}

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

/**
 * Add a block reference to a lesson's blocks array (appended at end).
 * No-op if a block with the same ref ID already exists.
 */
export async function addBlockToLesson({
  payload,
  req,
  lessonId,
  refId,
  blockType,
}: {
  payload: Payload
  req: PayloadRequest
  lessonId: string
  refId: string
  blockType: 'exerciseRef' | 'contentPageRef'
}): Promise<void> {
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const blocks = parseBlocks(lesson.blocks)
  const refField = blockType === 'exerciseRef' ? 'exercise' : 'contentPage'

  // Check if already present
  const exists = blocks.some((b) => b.blockType === blockType && b[refField] === refId)
  if (exists) return

  const newBlock: BlockEntry = {
    id: generateBlockId(),
    blockType,
    [refField]: refId,
  }

  const updated = [...blocks, newBlock]

  await payload.update({
    collection: 'lessons',
    id: lessonId,
    data: { blocks: serializeBlocks(updated) },
    overrideAccess: true,
    req,
    context: { _skipBlockSync: true },
  })
}

/**
 * Remove a block reference from a lesson's blocks array.
 */
export async function removeBlockFromLesson({
  payload,
  req,
  lessonId,
  refId,
  blockType,
}: {
  payload: Payload
  req: PayloadRequest
  lessonId: string
  refId: string
  blockType: 'exerciseRef' | 'contentPageRef'
}): Promise<void> {
  const lesson = await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const blocks = parseBlocks(lesson.blocks)
  const refField = blockType === 'exerciseRef' ? 'exercise' : 'contentPage'
  const filtered = blocks.filter((b) => !(b.blockType === blockType && b[refField] === refId))

  if (filtered.length === blocks.length) return // nothing to remove

  await payload.update({
    collection: 'lessons',
    id: lessonId,
    data: { blocks: serializeBlocks(filtered) },
    overrideAccess: true,
    req,
    context: { _skipBlockSync: true },
  })
}
```

**Verify:** `pnpm typecheck` passes

---

## Step 2: Add afterChange hook to Exercises collection

**File:** `src/server/payload/collections/Exercises/index.ts`
**Change:** Add `hooks: { afterChange: [...], afterDelete: [...] }` that auto-sync lesson blocks.

**What to add** (after the `access` block, before `admin`):

```typescript
import { addBlockToLesson, removeBlockFromLesson } from '../../hooks/lessons/syncLessonBlocks'

// In the collection config:
hooks: {
  afterChange: [
    async ({ doc, previousDoc, req }) => {
      if (req.context._skipBlockSync) return doc

      const newLessonId = typeof doc.lesson === 'string' ? doc.lesson : doc.lesson?.id
      const oldLessonId = previousDoc
        ? typeof previousDoc.lesson === 'string' ? previousDoc.lesson : previousDoc.lesson?.id
        : null

      // Lesson changed — remove from old, add to new
      if (oldLessonId && oldLessonId !== newLessonId) {
        await removeBlockFromLesson({
          payload: req.payload,
          req,
          lessonId: oldLessonId,
          refId: doc.id,
          blockType: 'exerciseRef',
        })
      }

      if (newLessonId) {
        await addBlockToLesson({
          payload: req.payload,
          req,
          lessonId: newLessonId,
          refId: doc.id,
          blockType: 'exerciseRef',
        })
      }

      return doc
    },
  ],
  afterDelete: [
    async ({ doc, req }) => {
      if (req.context._skipBlockSync) return doc

      const lessonId = typeof doc.lesson === 'string' ? doc.lesson : doc.lesson?.id
      if (lessonId) {
        await removeBlockFromLesson({
          payload: req.payload,
          req,
          lessonId,
          refId: doc.id,
          blockType: 'exerciseRef',
        })
      }

      return doc
    },
  ],
},
```

**Why:** When exercises are created/updated/deleted, automatically keep the parent lesson's blocks in sync.

**Verify:** `pnpm typecheck` passes

---

## Step 3: Add afterChange/afterDelete hooks to ContentPages collection

**File:** `src/server/payload/collections/ContentPages.ts`
**Change:** Add identical sync hooks, using `contentPageRef` blockType.

**What to add** (extend the existing `hooks.beforeChange` with `afterChange` and `afterDelete`):

```typescript
import { addBlockToLesson, removeBlockFromLesson } from '../hooks/lessons/syncLessonBlocks'

hooks: {
  beforeChange: [
    // ... existing beforeChange hook ...
  ],
  afterChange: [
    async ({ doc, previousDoc, req }) => {
      if (req.context._skipBlockSync) return doc

      const newLessonId = typeof doc.lesson === 'string' ? doc.lesson : doc.lesson?.id
      const oldLessonId = previousDoc
        ? typeof previousDoc.lesson === 'string' ? previousDoc.lesson : previousDoc.lesson?.id
        : null

      if (oldLessonId && oldLessonId !== newLessonId) {
        await removeBlockFromLesson({
          payload: req.payload,
          req,
          lessonId: oldLessonId,
          refId: doc.id,
          blockType: 'contentPageRef',
        })
      }

      if (newLessonId) {
        await addBlockToLesson({
          payload: req.payload,
          req,
          lessonId: newLessonId,
          refId: doc.id,
          blockType: 'contentPageRef',
        })
      }

      return doc
    },
  ],
  afterDelete: [
    async ({ doc, req }) => {
      if (req.context._skipBlockSync) return doc

      const lessonId = typeof doc.lesson === 'string' ? doc.lesson : doc.lesson?.id
      if (lessonId) {
        await removeBlockFromLesson({
          payload: req.payload,
          req,
          lessonId,
          refId: doc.id,
          blockType: 'contentPageRef',
        })
      }

      return doc
    },
  ],
},
```

**Why:** Same sync logic for content pages as for exercises.

**Verify:** `pnpm typecheck` passes

---

## Step 4: Create the one-time migration to populate existing lessons

**File:** `src/server/payload/migrations/populateLessonBlocks.ts` (new)
**Change:** Create a migration that iterates all exercises and content pages, and populates each lesson's blocks array based on existing relationships. Runs on server init (idempotent — skips lessons that already have blocks for the given refs).

**Code:**

```typescript
/**
 * @fileType utility
 * @domain lessons
 * @pattern migration
 * @ai-summary One-time migration to populate lesson blocks from existing exercises and content pages
 */

import type { Payload } from 'payload'

interface BlockEntry {
  id: string
  blockType: 'exerciseRef' | 'contentPageRef'
  exercise?: string
  contentPage?: string
}

function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 14)
}

function parseBlocks(raw: unknown): BlockEntry[] {
  if (Array.isArray(raw)) return raw as BlockEntry[]
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as BlockEntry[]
    } catch {
      /* ignore */
    }
  }
  return []
}

export async function populateLessonBlocks(
  payload: Payload,
): Promise<{ lessonsUpdated: number; blocksAdded: number; errors: number }> {
  let lessonsUpdated = 0
  let blocksAdded = 0
  let errors = 0

  // Build a map: lessonId -> blocks to add
  const lessonBlocksMap = new Map<string, BlockEntry[]>()

  // 1. Fetch all exercises
  let page = 1
  let hasMore = true
  while (hasMore) {
    const result = await payload.find({
      collection: 'exercises',
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      pagination: true,
    })
    for (const exercise of result.docs) {
      const lessonId = typeof exercise.lesson === 'string' ? exercise.lesson : exercise.lesson?.id
      if (!lessonId) continue
      const existing = lessonBlocksMap.get(lessonId) || []
      existing.push({
        id: generateBlockId(),
        blockType: 'exerciseRef',
        exercise: exercise.id,
      })
      lessonBlocksMap.set(lessonId, existing)
    }
    hasMore = result.hasNextPage
    page++
  }

  // 2. Fetch all content pages
  page = 1
  hasMore = true
  while (hasMore) {
    const result = await payload.find({
      collection: 'content-pages',
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
      pagination: true,
    })
    for (const cp of result.docs) {
      const lessonId = typeof cp.lesson === 'string' ? cp.lesson : cp.lesson?.id
      if (!lessonId) continue
      const existing = lessonBlocksMap.get(lessonId) || []
      existing.push({
        id: generateBlockId(),
        blockType: 'contentPageRef',
        contentPage: cp.id,
      })
      lessonBlocksMap.set(lessonId, existing)
    }
    hasMore = result.hasNextPage
    page++
  }

  // 3. For each lesson, merge new blocks (skip duplicates)
  for (const [lessonId, newBlocks] of lessonBlocksMap) {
    try {
      const lesson = await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        depth: 0,
        overrideAccess: true,
      })

      const existingBlocks = parseBlocks(lesson.blocks)

      // Build set of existing ref IDs
      const existingRefs = new Set<string>()
      for (const b of existingBlocks) {
        if (b.blockType === 'exerciseRef' && b.exercise) existingRefs.add(`exercise:${b.exercise}`)
        if (b.blockType === 'contentPageRef' && b.contentPage)
          existingRefs.add(`contentPage:${b.contentPage}`)
      }

      // Only add blocks that don't already exist
      const toAdd = newBlocks.filter((b) => {
        const key =
          b.blockType === 'exerciseRef' ? `exercise:${b.exercise}` : `contentPage:${b.contentPage}`
        return !existingRefs.has(key)
      })

      if (toAdd.length === 0) continue

      const merged = [...existingBlocks, ...toAdd]
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        data: { blocks: JSON.stringify(merged) },
        overrideAccess: true,
        context: { _skipBlockSync: true },
      })

      lessonsUpdated++
      blocksAdded += toAdd.length
    } catch {
      errors++
      payload.logger?.warn(`Failed to populate blocks for lesson ${lessonId}`)
    }
  }

  return { lessonsUpdated, blocksAdded, errors }
}

export async function runPopulateLessonBlocksOnInit(payload: Payload): Promise<void> {
  const { lessonsUpdated, blocksAdded, errors } = await populateLessonBlocks(payload)
  if (lessonsUpdated > 0 || errors > 0) {
    payload.logger?.info(
      `[populateLessonBlocks] Updated ${lessonsUpdated} lessons, added ${blocksAdded} blocks (${errors} errors)`,
    )
  }
}
```

**Why:** Existing data needs to be backfilled. Uses the same idempotent pattern as `backfillAdminTitle.ts`.

**Verify:** `pnpm typecheck` passes

---

## Step 5: Wire migration into onInit

**File:** `src/payload.config.ts`
**Change:** Import and call `runPopulateLessonBlocksOnInit` in the `onInit` handler, after the existing `runBackfillOnInit`.

```typescript
import { runPopulateLessonBlocksOnInit } from '@/server/payload/migrations/populateLessonBlocks'

// In onInit, after runBackfillOnInit(payload):
await runPopulateLessonBlocksOnInit(payload)
```

**Why:** Runs the migration automatically on deployment.

**Verify:** `pnpm typecheck` passes

---

## Step 6: Update LessonBlocksField UI — remove add/delete buttons

**File:** `src/ui/admin/LessonBlocksField/index.tsx`
**Change:**

1. Remove the `removeBlock` callback and the `<Trash2>` button from each row (lines 241-246, 498-512)
2. Remove the "Add Exercise" and "Add Content Page" buttons (lines 517-559)
3. Remove the picker modal and all picker-related state/callbacks (`showPicker`, `pickerResults`, `pickerLoading`, `pickerSearch`, `openPicker`, `addBlock`, `filteredResults`, `addedIds` — lines 248-319, 561-682)
4. Remove unused imports (`Plus`, `Trash2`)
5. Update the empty-state message from "No blocks added yet. Add exercises or content pages below." to "No blocks yet. Create exercises or content pages for this lesson."

**Why:** Blocks are now auto-populated — manual add/delete is no longer needed. Keep drag-and-drop reorder and move up/down.

**Verify:** `pnpm typecheck` passes, visual check in admin panel

---

## Step 7: Run type generation

**File:** N/A (command)
**Change:** Run `pnpm generate:types` and `pnpm generate:importmap`

**Why:** We've added hooks to collections and modified an admin component. Need to ensure generated types and importmap are up to date.

**Verify:** `pnpm typecheck` passes

---

## Step 8: Verify full quality gates

**File:** N/A (command)
**Change:** Run `pnpm ci:local` to execute typecheck, lint, and tests.

**Verify:** All checks pass

---

## Questions

1. **Migration removal timing** — The `runPopulateLessonBlocksOnInit` migration runs on every server start. Recommend keeping it for 1-2 deployment cycles then removing it (it's idempotent so no harm, just unnecessary work). Alternatively, I can add a config flag check (e.g., check if a config-value "lesson-blocks-migrated" exists). Which approach do you prefer? **Recommendation: keep as-is since it's idempotent and fast — remove in a follow-up PR.**

2. **Block ordering for migration** — When populating existing lessons, exercises will be ordered by their insertion order from the DB query (effectively by creation date). Should we instead sort by the existing `order` field on exercises? Content pages don't have an `order` field, so they'd go after exercises. **Recommendation: sort exercises by `order` field, then append content pages by creation date.**
