# Plan: Lesson Introduction Page Block-Based Content

**Task ID**: 260318-auto-461
**Task Type**: fix_bug
**Spec**: Lesson introduction page uses plain textarea with QuillField; should use Payload's native block editor for rich, structured content (text, media, HTML/SVG).

---

## Research Findings

- ✅ `src/server/payload/collections/Lessons.ts` — Current `introDescription` is `type: 'textarea'` with QuillField custom component (line 186-195)
- ✅ `src/server/payload/collections/Pages/index.ts` — Uses `type: 'blocks'` with `[CallToAction, Content, Archive, FormBlock, HtmlBlock]` (line 78-79)
- ✅ `src/server/payload/blocks/HtmlBlock/config.ts` — HTML block with validation, uses QuillField
- ✅ `src/server/payload/blocks/Content/config.ts` — Rich text content block with columns
- ✅ `src/server/payload/blocks/MediaBlock/config.ts` — Simple media upload block
- ✅ `src/server/payload/blocks/RenderBlocks.tsx` — Generic block renderer (maps blockType → component)
- ✅ `src/ui/web/SafeHtml/index.tsx` — Current rendering of `introDescription` HTML string via DOMPurify
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — Frontend component receiving `introDescription` as `string | null` and rendering via `<SafeHtml>` (lines 242-247)
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` — Server page passing `lesson.introDescription` to ExercisesPager (line 144)
- ✅ `tests/unit/collections/lessons-schema.spec.ts` — Existing schema test pattern for Lessons collection
- ✅ `src/payload-types.ts` — Current type: `introDescription?: string | null` (line 1307)
- ✅ `src/ui/admin/QuillField/index.tsx` — Quill-based WYSIWYG editor (will be retained for `description` field but removed from `introDescription`)

### Patterns Observed

- Pages collection uses `type: 'blocks'` with an array of block configs for structured content
- `RenderBlocks.tsx` maps `blockType` keys to React components for frontend rendering
- Block types available: `Content` (rich text + columns), `HtmlBlock` (raw HTML), `MediaBlock` (uploads), `CallToAction`, `FormBlock`, `Archive`, `Banner`, `Code`
- The clarification says: "HtmlBlockEditor", "text, media (image, video), x graph, geometry, svg, html" — meaning use existing HtmlBlock, Content (richtext), and MediaBlock blocks

### Integration Points

- Must update `Lessons.ts` collection config (change field type)
- Must update `ExercisesPager/index.tsx` (change rendering from SafeHtml to RenderBlocks)
- Must update lesson `page.tsx` (change prop passing)
- Must run `pnpm generate:types` to regenerate `payload-types.ts`
- Must run `pnpm generate:importmap` after block config changes

---

## Reuse Inventory

### Existing Utilities/Functions to Reuse

- **`Content` block** from `src/server/payload/blocks/Content/config.ts` — Rich text with formatting (headings, bold, italic, lists, links)
- **`HtmlBlock` block** from `src/server/payload/blocks/HtmlBlock/config.ts` — Raw HTML/SVG with validation (geometry, graphs, SVG content)
- **`MediaBlock` block** from `src/server/payload/blocks/MediaBlock/config.ts` — Image/video upload
- **`RenderBlocks` component** from `src/server/payload/blocks/RenderBlocks.tsx` — Renders block array to React components
- **`adminOnly` access** from `src/server/payload/access/adminOnly` — Already used in Lessons
- **`publishedAndActive` access** from `src/server/payload/access/publishedAndActive` — Already used in Lessons

### New Code Justification

- **No new utilities needed** — all block types and rendering infrastructure already exist
- Minor prop type changes to existing components (ExercisesPager)

---

## Plan Steps

### Step 1: Replace `introDescription` textarea with `introContent` blocks field in Lessons collection

**Root Cause**: The `introDescription` field is `type: 'textarea'` which stores plain text/HTML string. It should be `type: 'blocks'` to leverage Payload's native block editor for structured content.

**Files to Touch**:

- `src/server/payload/collections/Lessons.ts` (MODIFIED — lines 185-195)

**Exact Behavior**:

Replace the `introDescription` field (lines 185-195) with a new `introContent` field:

```
{
  name: 'introContent',
  type: 'blocks',
  blocks: [Content, HtmlBlock, MediaBlock],
  admin: {
    description: 'Block-based content for the intro page. Supports rich text, HTML/SVG, and media.',
    condition: (data) => Boolean(data?.introEnabled),
    initCollapsed: true,
  },
}
```

Add imports for `Content`, `HtmlBlock`, and `MediaBlock` block configs at the top of the file.

The field name changes from `introDescription` to `introContent` because it's no longer a description string but a blocks array. This is a new field — the clarification says "fresh start".

**Tests that FAIL before, PASS after**:

1. **Test**: `tests/unit/collections/lessons-intro-blocks.spec.ts` (NEW)
   - `introContent field exists and is type blocks` — Checks the Lessons config has a field named `introContent` with `type: 'blocks'`
   - `introContent field has Content, HtmlBlock, and MediaBlock blocks` — Checks the blocks array includes the 3 block types
   - `introContent is conditional on introEnabled` — Checks the admin condition function
   - `old introDescription field does not exist` — Ensures the textarea field was removed

**Run**: `pnpm vitest run tests/unit/collections/lessons-intro-blocks.spec.ts`

**Acceptance Criteria**:

- [ ] `introDescription` field (textarea) is removed from Lessons.ts
- [ ] `introContent` field (blocks) is added with `Content`, `HtmlBlock`, `MediaBlock` blocks
- [ ] Field is conditional on `introEnabled`
- [ ] Block imports are added at top of file

---

### Step 2: Update frontend to render blocks instead of HTML string

**Root Cause**: The ExercisesPager component renders `introDescription` as a raw HTML string via `<SafeHtml>`. It needs to render the new `introContent` blocks array using `<RenderBlocks>`.

**Files to Touch**:

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (MODIFIED — lines 18-44, 225-280)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — lines 144)

**Exact Behavior**:

**In ExercisesPager/index.tsx**:
1. Change the `introDescription` prop from `string | null` to an array type matching the blocks output (use the generated `Lesson['introContent']` type from payload-types)
2. Rename prop from `introDescription` to `introContent`
3. Replace `<SafeHtml html={introDescription} ...>` (line 242-247) with `<RenderBlocks blocks={introContent} />`
4. Update `hasAboutPage` check (line 44) to use `introContent?.length > 0` instead of `Boolean(introDescription)`
5. Remove `SafeHtml` import, add `RenderBlocks` import
6. Add appropriate wrapper styling for the blocks in the about page context

**In page.tsx**:
1. Change line 144 from `introDescription={lesson.introEnabled ? lesson.introDescription : null}` to `introContent={lesson.introEnabled ? (lesson.introContent ?? []) : []}`

**Tests that FAIL before, PASS after**:

1. **Test**: `tests/unit/components/ExercisesPager-intro-blocks.spec.tsx` (NEW)
   - `renders RenderBlocks when introContent has blocks` — Mock ExercisesPager with introContent blocks array, verify RenderBlocks component is rendered
   - `does not show about page when introContent is empty` — Pass empty array, verify about page section is not rendered
   - `shows about page when introContent has blocks` — Pass non-empty blocks array, verify hasAboutPage is true and about section shows

**Run**: `pnpm vitest run tests/unit/components/ExercisesPager-intro-blocks.spec.tsx`

**Acceptance Criteria**:

- [ ] ExercisesPager accepts `introContent` (blocks array) instead of `introDescription` (string)
- [ ] Blocks are rendered via `<RenderBlocks>` component
- [ ] `hasAboutPage` correctly detects non-empty blocks
- [ ] `SafeHtml` import is removed from ExercisesPager (no longer needed here)
- [ ] page.tsx passes `introContent` instead of `introDescription`

---

### Step 3: Generate types and import map, verify TypeScript compiles

**Files to Touch**:

- `src/payload-types.ts` (AUTO-GENERATED — via `pnpm generate:types`)
- `src/app/(payload)/admin/importMap.js` (AUTO-GENERATED — via `pnpm generate:importmap`)

**Exact Behavior**:

Run:
```bash
pnpm generate:types
pnpm generate:importmap
pnpm tsc --noEmit
```

The generated `Lesson` type in `payload-types.ts` should change:
- Remove: `introDescription?: string | null`
- Add: `introContent?: (ContentBlock | HtmlBlock | MediaBlock)[] | null` (exact type depends on Payload generation)

**Tests that FAIL before, PASS after**:

1. **Test**: TypeScript compilation (`pnpm tsc --noEmit`)
   - Should compile cleanly with zero errors
   - This validates all type references across the codebase are correct after the schema change

**Run**: `pnpm tsc --noEmit`

**Acceptance Criteria**:

- [ ] `pnpm generate:types` runs successfully
- [ ] `pnpm generate:importmap` runs successfully
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] Generated types reflect `introContent` as blocks array type
- [ ] No remaining references to `introDescription` in non-test, non-migration code

---

### Step 4: Verify no stale references to `introDescription`

**Files to Touch**: None (verification only)

**Exact Behavior**:

Search the entire codebase for remaining references to `introDescription` and ensure they are either:
- Removed
- Updated to `introContent`

Key locations to verify:
- `src/server/payload/collections/Lessons.ts` — field removed
- `src/app/(frontend)/.../ExercisesPager/index.tsx` — prop renamed
- `src/app/(frontend)/.../page.tsx` — prop renamed
- `src/payload-types.ts` — regenerated (no `introDescription`)

**Tests that FAIL before, PASS after**:

1. **Test**: The test from Step 1 (`old introDescription field does not exist`) already covers this at the schema level
2. **Test**: `pnpm tsc --noEmit` from Step 3 will fail if any code still references the removed type

**Run**: `pnpm tsc --noEmit && pnpm lint`

**Acceptance Criteria**:

- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] `introDescription` string references are fully replaced by `introContent` blocks references
- [ ] All unit tests pass: `pnpm vitest run tests/unit/collections/lessons-intro-blocks.spec.ts tests/unit/components/ExercisesPager-intro-blocks.spec.tsx`
