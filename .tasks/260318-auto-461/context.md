# Codebase Context: 260318-auto-461

## Files to Modify
- `src/server/payload/collections/Lessons.ts` (lines 1-263) — Replace `introDescription` textarea field with `introContent` blocks field
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (lines 1-337) — Change `introDescription: string` prop to `introContent: blocks[]` prop, replace SafeHtml with RenderBlocks
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (line 144) — Pass `introContent` instead of `introDescription`
- `tests/unit/collections/lessons-intro-blocks.spec.ts` (NEW) — Unit tests for intro blocks field config
- `tests/unit/components/ExercisesPager-intro-blocks.spec.tsx` (NEW) — Unit tests for block rendering in ExercisesPager

## Files to Read (reference patterns)
- `src/server/payload/collections/Pages/index.ts` — Pattern for blocks field usage (`type: 'blocks'` with block array)
- `src/server/payload/blocks/RenderBlocks.tsx` — Pattern for rendering blocks on frontend
- `src/server/payload/blocks/Content/config.ts` — Content block config to import
- `src/server/payload/blocks/HtmlBlock/config.ts` — HtmlBlock config to import
- `src/server/payload/blocks/MediaBlock/config.ts` — MediaBlock config to import
- `tests/unit/collections/lessons-schema.spec.ts` — Test pattern for Lessons collection schema tests
- `src/ui/web/SafeHtml/index.tsx` — Currently used for intro rendering (to be replaced)
- `src/ui/admin/QuillField/index.tsx` — Current admin editor (QuillField stays for `description` field, removed from `introDescription`)

## Key Signatures
- `RenderBlocks: React.FC<{ blocks: Page['layout'][0][] }>` from `src/server/payload/blocks/RenderBlocks.tsx`
- `Content: Block` from `src/server/payload/blocks/Content/config.ts`
- `HtmlBlock: Block` from `src/server/payload/blocks/HtmlBlock/config.ts`
- `MediaBlock: Block` from `src/server/payload/blocks/MediaBlock/config.ts`
- `Lessons: CollectionConfig` from `src/server/payload/collections/Lessons.ts`
- `ExercisesPager` component from `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`

## Reuse Inventory
- `Content` block from `src/server/payload/blocks/Content/config.ts` — Rich text content with columns
- `HtmlBlock` block from `src/server/payload/blocks/HtmlBlock/config.ts` — Raw HTML/SVG with validation
- `MediaBlock` block from `src/server/payload/blocks/MediaBlock/config.ts` — Image/video upload
- `RenderBlocks` from `src/server/payload/blocks/RenderBlocks.tsx` — Block rendering on frontend
- `adminOnly` from `src/server/payload/access/adminOnly` — Already used in Lessons collection
- `publishedAndActive` from `src/server/payload/access/publishedAndActive` — Already used in Lessons collection
- `formatSlug` from `src/server/payload/fields/formatSlug` — Already imported in Lessons

## Integration Points
- Must run `pnpm generate:types` after schema change to regenerate `src/payload-types.ts`
- Must run `pnpm generate:importmap` after adding block references to update admin import map
- `RenderBlocks` component currently typed to `Page['layout'][0][]` — the blocks type for Lessons `introContent` will be similar but with a subset of blocks; may need a type cast or a wider type
- `introMedia` field is separate from blocks — it can remain as-is since blocks can also contain MediaBlock content; keeping `introMedia` provides backward compatibility for existing data

## Imports Verified
- `@/server/payload/blocks/Content/config` → exports `Content: Block` ✅
- `@/server/payload/blocks/HtmlBlock/config` → exports `HtmlBlock: Block` ✅
- `@/server/payload/blocks/MediaBlock/config` → exports `MediaBlock: Block` ✅
- `@/server/payload/blocks/RenderBlocks` → exports `RenderBlocks: React.FC` ✅
- `@/server/payload/access/adminOnly` → exports `adminOnly: Access` ✅
- `@/server/payload/access/publishedAndActive` → exports `publishedAndActive: Access` ✅
- `@/ui/web/SafeHtml` → exports `SafeHtml` component (to be removed from ExercisesPager) ✅
