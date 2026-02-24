# Plan: HTML Content Pages & Lesson Blocks

## Summary

Two features are needed to support rich HTML content within lessons:

1. **ContentPages collection** — A new Payload collection storing full HTML content pages (using the existing `HtmlBlock` pattern with the Quill WYSIWYG editor), linked to a lesson.
2. **Lesson Blocks** — A polymorphic ordered list on the Lesson collection that can contain either an exercise reference **or** a content page reference. The frontend pager (`ExercisesPager`) will be generalized to iterate through these mixed blocks.

### Current State
- Lessons have exercises linked via a `lesson` relationship on the `Exercises` collection. The `order` field on the exercise determines the sequence.
- The `ExercisesPager` component pages through exercises only.
- An `HtmlBlock` Payload block already exists for the `Pages` collection (with full validation, allowed tags, security checks).
- A `QuillField` WYSIWYG admin component exists and is used for `description` fields on Lessons/Chapters.
- There is no concept of "lesson blocks" — lesson content is purely exercises.

### Architecture Decisions
- **ContentPages** will be a standalone collection so they can be managed independently, but their order and inclusion in a lesson is strictly governed by the lesson's `blocks` array.
- **Lesson `blocks` field** will be a Payload `blocks` field (ordered array) with two block types: `exerciseRef` and `contentPageRef`. **This is now the sole source of truth for lesson content and ordering.**
- **NO Backward Compatibility / Deprecation**: The `order` field on `Exercises` will be removed. All lessons MUST use the `blocks` array to define their content and order. The implicit "fetch exercises by lesson ID" fallback is removed.
- The ContentPages collection will use the **same HTML validation** as the existing HtmlBlock to maintain security consistency.
- **Slug uniqueness** is scoped to the lesson (not globally unique).
- **Read access** uses a published-or-authenticated pattern.

### Assumptions
- A1: The user wants full HTML editing (not Lexical rich-text) — consistent with existing QuillField usage.
- A2: Content pages are admin-created, student-readable when published.
- A3: **All existing and new lessons will use the `blocks` field.** The fallback query is not needed.
- A4: The pager should handle mixed content seamlessly.
- A5: The `/pages/[pageSlug]` route renders the **full pager** (not standalone), matching how `/exercises/[exerciseSlug]` works.

---

## Step 1: Create ContentPages Collection

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/server/payload/collections/ContentPages/index.ts` (NEW)
- `src/server/payload/collections/ContentPages/hooks.ts` (NEW — slug generation + uniqueness)
- `src/payload.config.ts` (MODIFIED — add to collections array)

**Exact Behavior**:
- New collection `content-pages` with fields:
  - `title` (text, required)
  - `slug` (text, indexed) — URL-friendly identifier, auto-generated from title. Unique within lesson scope.
  - `lesson` (relationship → lessons, required, indexed)
  - `htmlContent` (textarea field, required) — Uses `QuillField` admin component.
  - `status` (select: draft/published, default: draft)
  - `isActive` (checkbox, default: true)
  - `tenantField`, `createdByField`
  - *(Note: No `order` field needed since the Lesson blocks array handles ordering)*
- Access control: adminOnly for CUD, published-or-authenticated for read.

---

## Step 2: Extract Shared HTML Validation Utility

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/server/payload/fields/htmlValidation.ts` (NEW)
- `src/server/payload/blocks/HtmlBlock/config.ts` (MODIFIED)
- `src/server/payload/collections/ContentPages/index.ts` (MODIFIED)

**Exact Behavior**:
- Extract the `validate` function body from `HtmlBlock/config.ts` into a shared utility `validateHtmlContent`.
- Both `HtmlBlock` and `ContentPages` use this shared validator.

---

## Step 3: Add `blocks` Field to Lessons & Remove `order` from Exercises

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/server/payload/blocks/LessonBlocks/ExerciseRefBlock.ts` (NEW)
- `src/server/payload/blocks/LessonBlocks/ContentPageRefBlock.ts` (NEW)
- `src/server/payload/collections/Lessons.ts` (MODIFIED — add `blocks` field)
- `src/server/payload/collections/Exercises/index.ts` (MODIFIED — remove `order` field)

**Exact Behavior**:
- **ExerciseRefBlock** & **ContentPageRefBlock**: Standard Payload blocks referencing their respective collections.
- **Lessons collection**: Add `blocks` field (required: true, minRows: 1). This is now the strict, required way to add content to a lesson.
- **Exercises collection**: **DELETE the `order` field.** (Lines 76-84 in `Exercises/index.ts`).

---

## Step 4: Update Query Functions (Strict Blocks Mode)

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/server/repos/queries/contentPages.ts` (NEW)
- `src/server/repos/queries/lessonBlocks.ts` (NEW)
- `src/server/repos/queries/exercises.ts` (MODIFIED - remove obsolete order-based queries)

**Exact Behavior**:
- `queryLessonBlocks({ lessonId })`:
  1. Fetch the lesson at depth: 0.
  2. Batch-resolve the `blocks` array (fetch all referenced exercises and content pages in two bulk queries).
  3. Return ordered `LessonBlock[]`.
  4. *No fallback logic.* If a lesson has no blocks, it has no content.
- Remove or refactor `queryExercisesByLesson` in `exercises.ts` as it no longer relies on the `order` field and should not be used for lesson rendering.

---

## Step 5: Create ContentPage Renderer Component

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/ui/web/ContentPageRenderer/index.tsx` (NEW)

**Exact Behavior**:
- Client component rendering HTML safely via `SafeHtml`.
- Styled consistently with exercise cards.

---

## Step 6: Generalize Pager → LessonPager

**Time estimate**: 30 minutes

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonPager/*` (NEW/MODIFIED)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED)

**Exact Behavior**:
- Hook and component accept `blocks: LessonBlock[]` instead of `exercises`.
- Progress and pagination based entirely on the blocks array.
- URL syncing uses `/exercises/{slug}` and `/content/{slug}`.

---

## Step 7: Add Content Page Route

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/content/[pageSlug]/page.tsx` (NEW)

**Exact Behavior**:
- Route renders the full `LessonPager`. Pager auto-detects current page from URL.

---

## Step 8: Enhanced Admin Editor

**Time estimate**: 20 minutes

**Files to Touch**:
- `src/ui/admin/ContentPageEditor/index.tsx` (NEW)

**Exact Behavior**:
- Full-page WYSIWYG editor for content pages with live preview.

---

## Step 9: Tests & Cleanup

**Time estimate**: 20 minutes

**Files to Touch**:
- `tests/int/lesson-blocks-e2e.int.spec.ts` (NEW)
- Fix broken tests related to the removed `order` field on exercises.
