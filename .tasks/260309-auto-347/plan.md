# Plan: Fix Video Rendering for Students

## Rerun Context

Rerun requested without specific code-level feedback. Previous plan did not exist. This is a fresh plan analyzing root causes and providing step-by-step fix guidance.

## Root Cause Analysis

Two distinct bugs prevent student video rendering:

### Bug 1: Exercise `media` blocks have no renderer
The `media` block type exists in the schema (`schemas.ts`, `types.ts`) and `ContentBlockSchema` discriminated union, but the `ExerciseRenderer/index.tsx` has **no case** for `block.type === 'media'`. When the renderer iterates through `content.blocks`, any block with `type: 'media'` falls through all conditionals and renders nothing — no error, no fallback, just silent skip.

### Bug 2: Lesson intro media always renders as `<img>`
In `ExercisesPager/index.tsx` (line 249-257), the about page only renders `introMedia` as `<img>`. There's no check for whether the media is a video — it always uses `<img>` regardless of `mimeType` or `type` field on the Media object.

### Bug 3: `extractMediaIds` misses `media` block's `mediaId`
The `extractMediaIds` utility only collects `mediaIds` arrays from `LooseRichText` sub-objects. It does NOT collect the `mediaId` field from `media` type blocks (singular, not plural). Without this, even if a renderer existed, the pre-fetched `mediaMap` would not contain the video Media document.

---

## Assumptions

- A1: The Lessons collection `introMedia` field (line 192-199 of Lessons.ts) is an `upload` field to `media` collection. When queried with sufficient depth, it returns a populated Media object with `url`, `mimeType`, `type` etc.
- A2: Media documents have `type` field (e.g., `'video'`, `'image'`) and `mimeType` field (e.g., `'video/mp4'`).
- A3: The `queryLessonBySlug` returns `introMedia` as a populated object (not just an ID) since the lesson page already uses `introMediaObj.url`.
- A4: Videos are stored via Vercel Blob; their `url` field is already absolute (e.g., `https://...blob.vercel-storage.com/...`). The `getMediaUrl` utility handles both relative and absolute URLs.
- A5: Media collection `read` access is `anyone` (line 94 of Media/index.ts), so no additional access enforcement is needed for resolving media URLs.

---

## Steps

### Step 1: Fix `extractMediaIds` to collect `mediaId` from `media` blocks

**Root Cause**: `extractMediaIds` only extracts `mediaIds` (array) from rich text sub-objects, but `media` blocks store a single `mediaId` (string). Without collecting this, the `mediaMap` passed to the renderer won't contain the video's Media document.

**Files to Touch**:
- `src/ui/web/exerciserenderer/utils/extractMediaIds.ts` (MODIFIED - lines 12-14, 40-43)

**Reproduction Test**: Write a test that demonstrates the bug (MUST FAIL now):
- Test location: `tests/unit/ui/extractMediaIds.test.ts`
- Test: `extractMediaIds should collect mediaId from media blocks`
- Input: `{ blocks: [{ type: 'media', mediaId: 'vid-123', id: 'b1' }] }`
- Expected output: `['vid-123']`
- Why it fails: Currently returns `[]` because the loop only calls `collect()` on `block.mediaIds`, `block.prompt`, etc. — never checks `block.mediaId`.

**Fix**:
- In `LooseBlock` interface, add `mediaId?: string` field
- In the `for (const block of content.blocks)` loop, after the existing `collect(block)` call, add:
  ```
  if (block.type === 'media' && block.mediaId) {
    ids.add(block.mediaId)
  }
  ```

**Verification**:
- `pnpm vitest run tests/unit/ui/extractMediaIds.test.ts` → FAILS before fix, PASSES after

**Acceptance Criteria**:
- [x] `extractMediaIds({ blocks: [{ type: 'media', mediaId: 'x', id: 'a' }] })` returns `['x']`
- [x] `extractAllMediaIds` with exercises containing `media` blocks returns those mediaIds
- [x] Existing tests for `mediaIds` arrays still pass (no regression)

**Spec Refs**: FR-001, FR-003, NFR-002

---

### Step 2: Create shared `VideoPlayer` component

**Root Cause**: No shared video rendering component exists. Both exercise video blocks and lesson intro video need to render `<video>` elements with consistent URL resolution, MIME type handling, and fallback behavior.

**Files to Touch**:
- `src/ui/web/exerciserenderer/components/VideoPlayer/index.tsx` (NEW)

**Reproduction Test**:
- Test location: `tests/unit/ui/VideoPlayer.test.tsx`
- Test 1: `VideoPlayer renders <video> element with absolute URL when given absolute src`
  - Input: `<VideoPlayer src="https://blob.example.com/vid.mp4" mimeType="video/mp4" />`
  - Expected: renders `<video>` with `<source src="https://blob.example.com/vid.mp4" type="video/mp4">`
  - Why it fails: Component doesn't exist yet

- Test 2: `VideoPlayer renders <video> with relative URL made absolute`
  - Input: `<VideoPlayer src="/api/media/file/vid.mp4" mimeType="video/mp4" />`
  - Expected: renders `<video>` with `<source src="http://localhost:3000/api/media/file/vid.mp4" type="video/mp4">`
  - Why it fails: Component doesn't exist yet

- Test 3: `VideoPlayer renders <video> without type attribute when mimeType is missing`
  - Input: `<VideoPlayer src="https://example.com/vid.mp4" />`
  - Expected: renders `<source>` without `type` attribute
  - Why it fails: Component doesn't exist yet

- Test 4: `VideoPlayer renders <video> without type attribute when mimeType is application/octet-stream`
  - Input: `<VideoPlayer src="https://example.com/vid.mp4" mimeType="application/octet-stream" />`
  - Expected: renders `<source>` without `type` attribute
  - Why it fails: Component doesn't exist yet

- Test 5: `VideoPlayer renders fallback message when src is empty/undefined`
  - Input: `<VideoPlayer />`
  - Expected: renders localized fallback text (the `videoUnavailable` key)
  - Why it fails: Component doesn't exist yet

**Fix**: Create a `VideoPlayer` client component:
```tsx
'use client'
// Props: src?: string | null, mimeType?: string | null, className?: string
// 1. If no src → render fallback message (i18n key: courses.videoUnavailable)
// 2. Use getMediaUrl() to make URL absolute
// 3. Determine if mimeType is renderable: starts with 'video/' → use it; otherwise omit type attr
// 4. Render <video controls playsInline> with <source>
// 5. Include onError handler that shows fallback text on load failure
```

**Verification**:
- `pnpm vitest run tests/unit/ui/VideoPlayer.test.tsx` → FAILS before (no component), PASSES after

**Acceptance Criteria**:
- [x] Component renders `<video>` with `controls` and `playsInline` attributes
- [x] Absolute URLs pass through unchanged
- [x] Relative URLs are prepended with base URL via `getMediaUrl`
- [x] `mimeType` starting with `video/` is used as `type` on `<source>`
- [x] Missing/unknown `mimeType` omits the `type` attribute (FR-005)
- [x] Missing src shows localized fallback (FR-008)

**Spec Refs**: FR-003, FR-004, FR-005, FR-008, NFR-001

---

### Step 3: Add i18n keys for video fallback messages

**Root Cause**: No i18n keys exist for video-related fallback/error messages.

**Files to Touch**:
- `src/i18n/en.json` (MODIFIED - add keys in `courses` namespace)
- `src/i18n/he.json` (MODIFIED - add keys in `courses` namespace)

**Reproduction Test**:
- Test location: `tests/unit/ui/VideoPlayer.test.tsx` (same as Step 2)
- Test: `VideoPlayer renders fallback message when src is empty` uses `t('videoUnavailable')`
- Why it fails now: Key doesn't exist, so `t()` returns the key name instead of user-facing text

**Fix**: Add the following keys to both locale files inside the `"courses"` object:
- `"videoUnavailable"`: EN: `"Video is not available"` / HE: `"הסרטון אינו זמין"`
- `"videoLoadError"`: EN: `"Failed to load video"` / HE: `"טעינת הסרטון נכשלה"`

**Verification**:
- Grep for keys in both json files → both present
- VideoPlayer tests pass with correct fallback text

**Acceptance Criteria**:
- [x] `en.json` has `videoUnavailable` and `videoLoadError` in `courses` namespace
- [x] `he.json` has matching Hebrew translations
- [x] Keys follow existing naming convention in the courses namespace

**Spec Refs**: NFR-003, FR-008

---

### Step 4: Add `media` block renderer in ExerciseRenderer

**Root Cause**: The `ExerciseRenderer/index.tsx` `content.blocks.map()` has no case for `block.type === 'media'`. These blocks are silently skipped, so exercise video blocks never render.

**Files to Touch**:
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED - add case in the blocks map, ~line 387)
- `src/ui/web/exerciserenderer/types.ts` (MODIFIED - add `MediaBlock` to `ContentBlock` union, lines 160-166)

**Reproduction Test**:
- Test location: `tests/unit/ui/ExerciseRenderer-video.test.tsx`
- Test 1: `ExerciseRenderer renders video element for media block with video type`
  - Setup: Render `ExerciseRenderer` with content containing a `media` block (mediaId: 'vid-1'), and a `mediaMap` containing `{ 'vid-1': { id: 'vid-1', type: 'video', url: 'https://blob.example.com/vid.mp4', mimeType: 'video/mp4', ... } }`
  - Expected: DOM contains a `<video>` element with source pointing to the video URL
  - Why it fails: No handler for `media` block type in the renderer — nothing renders

- Test 2: `ExerciseRenderer renders image for media block with image type`
  - Setup: Same but media has `type: 'image'`, `url: 'https://blob.example.com/img.png'`, `mimeType: 'image/png'`
  - Expected: DOM contains an `<img>` element (uses existing `MediaItem` from `MediaAttachments` or similar)
  - Why it fails: No handler for `media` block type

- Test 3: `ExerciseRenderer renders fallback for media block when mediaId not in mediaMap`
  - Setup: `media` block with `mediaId: 'missing-id'`, empty `mediaMap`
  - Expected: DOM contains fallback text (not a crash, not empty)
  - Why it fails: No handler

**Fix**:
1. In `types.ts`, add `MediaBlock` type to the file (import from `@/server/payload/collections/Exercises/types`) and add it to the `ContentBlock` union:
   ```ts
   import type { MediaBlock } from '@/server/payload/collections/Exercises/types'
   export type { MediaBlock }
   export type ContentBlock = RichTextBlock | HtmlBlock | QuestionBlock | SvgBlock | MediaBlock
   ```

2. In `ExerciseRenderer/index.tsx`, add a case in the `content.blocks.map()` block iterator (after the `html` block case and before the question blocks), approximately at line 397:
   ```tsx
   // Media block - render image or video from mediaMap
   if (block.type === 'media') {
     const mediaBlock = block as MediaBlock
     const media = mediaMap[mediaBlock.mediaId]
     if (!media) {
       return <div key={mediaBlock.id} className="..."><p>{t('videoUnavailable')}</p></div>
     }
     if (media.type === 'video' || media.mimeType?.startsWith('video/')) {
       return <div key={mediaBlock.id}><VideoPlayer src={media.url} mimeType={media.mimeType} /></div>
     }
     // Image or other — use existing MediaItem-like rendering
     return <div key={mediaBlock.id}><MediaItem media={media} /></div>
   }
   ```

3. Import `VideoPlayer` and the `MediaItem` component (or inline the image rendering from `MediaAttachments`).

**Verification**:
- `pnpm vitest run tests/unit/ui/ExerciseRenderer-video.test.tsx` → FAILS before, PASSES after
- Existing exercise renderer tests still pass (NFR-001)

**Acceptance Criteria**:
- [x] `media` blocks with video type render a `<video>` element with proper `src` (FR-001)
- [x] `media` blocks with image type render an `<img>` element (NFR-001 — no regression)
- [x] Missing media shows fallback (FR-008)
- [x] `mimeType` handling follows FR-005 rules
- [x] Video `src` is absolute URL (FR-004)

**Spec Refs**: FR-001, FR-003, FR-004, FR-005, FR-008, NFR-001

---

### Step 5: Fix lesson intro video rendering in ExercisesPager

**Root Cause**: In `ExercisesPager/index.tsx` line 249-257, the about page unconditionally renders `introMedia` as `<img>`. When the media is a video (e.g., `introMediaObj.type === 'video'` or `introMediaObj.mimeType?.startsWith('video/')`), students see a broken/missing image instead of a video player.

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (MODIFIED - lines 249-257)

**Reproduction Test**:
- Test location: `tests/unit/ui/ExercisesPager-intro-video.test.tsx`
- Test 1: `ExercisesPager about page renders video player for video introMedia`
  - Setup: Render ExercisesPager with `introDescription="Some text"`, `introMedia` as a populated Media object with `type: 'video'`, `url: 'https://blob.example.com/intro.mp4'`, `mimeType: 'video/mp4'`
  - Expected: DOM contains a `<video>` element
  - Why it fails: Code always renders `<img>` for `introMediaObj.url`

- Test 2: `ExercisesPager about page still renders image for image introMedia`
  - Setup: Same but `introMedia` has `type: 'image'`, `mimeType: 'image/png'`
  - Expected: DOM contains `<img>` element (no regression)
  - Why it fails before: It should pass already (always renders `<img>`)

**Fix**: In the about page section where `introMediaObj?.url` is checked (line 249), replace the unconditional `<img>` with a conditional:
```tsx
{introMediaObj?.url && (
  <div className="mx-auto max-h-80 overflow-hidden rounded-2xl mb-8">
    {(introMediaObj.type === 'video' || introMediaObj.mimeType?.startsWith('video/')) ? (
      <VideoPlayer
        src={introMediaObj.url}
        mimeType={introMediaObj.mimeType}
        className="mx-auto max-h-80 w-full"
      />
    ) : (
      <img
        src={getMediaUrl(introMediaObj.url)}
        alt={introMediaObj.alt || ''}
        className="mx-auto max-h-80 w-auto object-contain"
      />
    )}
  </div>
)}
```

Import `VideoPlayer` at the top of the file.

**Verification**:
- `pnpm vitest run tests/unit/ui/ExercisesPager-intro-video.test.tsx` → FAILS before, PASSES after
- Manual: lesson with video intro shows `<video>` player

**Acceptance Criteria**:
- [x] Video introMedia renders as `<video>` with working src (FR-002)
- [x] Image introMedia still renders as `<img>` (NFR-001)
- [x] Video URL is properly resolved (FR-004)
- [x] Missing mimeType doesn't prevent video rendering (FR-005)

**Spec Refs**: FR-002, FR-003, FR-004, FR-005, NFR-001

---

### Step 6: Verify access control and run quality gates

**Root Cause**: Must ensure no security regression — media queries must not bypass access control.

**Files to Touch**:
- No new files. Verification step only.

**Reproduction Test**:
- Test location: `tests/unit/ui/access-control-media.test.ts` (lightweight — verify that `queryMediaByIds` does NOT pass `overrideAccess: true`)
- Test: Verify that the `queryMediaByIds` function in `src/server/repos/queries/media.ts` does not include `overrideAccess: true` in its options (it currently doesn't set it at all, which means it defaults to `true` for Local API — but since Media `read` access is `anyone`, this is safe per assumption A5)
- Actually: The current `queryMediaByIds` uses `payload.find()` without `overrideAccess` (defaults to `true`). Since Media `read` is `anyone`, this is equivalent. No change needed.

**Fix**: No code changes. Confirm existing patterns are safe.

**Verification**:
- `pnpm -s tsc --noEmit` → passes (type safety)
- `pnpm -s lint` → passes
- `pnpm vitest run tests/unit/ui/` → all new tests pass
- Existing test suites not broken

**Acceptance Criteria**:
- [x] TypeScript compiles without errors
- [x] Lint passes
- [x] All new unit tests pass
- [x] All existing tests pass (no regressions)
- [x] No `overrideAccess: true` added where user context is expected (FR-006)

**Spec Refs**: FR-006, FR-007, NFR-001, NFR-004

---

## Summary of Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/ui/web/exerciserenderer/utils/extractMediaIds.ts` | MODIFIED | Collect `mediaId` from `media` blocks |
| `src/ui/web/exerciserenderer/components/VideoPlayer/index.tsx` | NEW | Shared video player component |
| `src/i18n/en.json` | MODIFIED | Add video fallback i18n keys |
| `src/i18n/he.json` | MODIFIED | Add video fallback i18n keys (Hebrew) |
| `src/ui/web/exerciserenderer/types.ts` | MODIFIED | Add `MediaBlock` to `ContentBlock` union |
| `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` | MODIFIED | Add `media` block rendering case |
| `src/app/.../ExercisesPager/index.tsx` | MODIFIED | Conditional video vs image for intro media |
| `tests/unit/ui/extractMediaIds.test.ts` | NEW | Test mediaId extraction |
| `tests/unit/ui/VideoPlayer.test.tsx` | NEW | Test video player component |
| `tests/unit/ui/ExerciseRenderer-video.test.tsx` | NEW | Test media block rendering |
| `tests/unit/ui/ExercisesPager-intro-video.test.tsx` | NEW | Test intro video rendering |

## Resolution Strategy

**Depth-based** (FR-007): Lesson intro media is already populated via depth. Exercise media blocks use `mediaMap` (pre-fetched batch query via `queryMediaByIds`). The fix ensures `extractMediaIds` collects IDs from `media` blocks so the batch query includes them. No additional server-side lookups at render time.

## Test Execution

```bash
# Run all new tests
pnpm vitest run tests/unit/ui/extractMediaIds.test.ts tests/unit/ui/VideoPlayer.test.tsx tests/unit/ui/ExerciseRenderer-video.test.tsx tests/unit/ui/ExercisesPager-intro-video.test.tsx

# Quality gates
pnpm -s tsc --noEmit
pnpm -s lint
```
