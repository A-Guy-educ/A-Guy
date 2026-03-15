# Plan: Fix PDF/Document Blank Display on Desktop Chrome

**Task ID**: 260313-auto-110
**Task Type**: fix_bug
**Spec Reference**: task.md (Bug Report)

## Rerun Context

This is a rerun with minimal feedback ("Rerun requested via /cody rerun"). The previous run did not produce plan artifacts. This plan is written from scratch based on thorough codebase analysis.

## Research Findings

### File Paths Verified
- ✅ `src/ui/web/media/PDFMedia/index.tsx` — PDF viewer component using iframe with `h-full`
- ✅ `src/ui/web/components/split-pane-layout.tsx` — Desktop vs mobile layout switcher
- ✅ `src/ui/web/components/resizable-pane.tsx` — Desktop horizontal split pane
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` — Lesson page that builds primaryContent for PDF display
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx` — Wrapper using SplitPaneLayout
- ✅ `src/infra/pdfjs/config.ts` — PDF.js viewer configuration
- ✅ `src/infra/pdfjs/renderer.ts` — PDF.js HTML rewrite pipeline
- ✅ `src/infra/pdfjs/validator.ts` — URL validation
- ✅ `src/infra/pdfjs/template-loader.ts` — CDN template fetcher
- ✅ `src/app/api/pdfjs-viewer/route.ts` — API route serving PDF.js viewer HTML
- ✅ `src/server/payload/hooks/useMediaQuery.ts` — Media query hook (returns false during SSR)

### Patterns Observed
- PDFMedia uses `h-full` CSS which requires complete height chain from ancestors
- SplitPaneLayout renders completely different JSX trees for desktop vs mobile
- Desktop path: `ResizablePane` → `flex-row` → first pane with `overflow-hidden`
- Mobile path: Direct `flex-col` children with `flex-1`
- The `useMediaQuery` hook returns `false` initially (SSR/hydration), causing a layout switch from mobile→desktop after mount on desktop devices

### Root Cause Analysis

**The bug has TWO contributing factors:**

#### Factor 1: Height chain collapse in desktop layout

The lesson page's `primaryContent` wraps PDF files in:
```jsx
<div className="w-full h-full flex flex-col">
  <div className="w-full h-full flex-shrink-0">
    <div className="border rounded-lg overflow-hidden bg-card shadow-lg h-full">
      <MediaComponent resource={file} className="w-full h-full" htmlElement={null} />
```

On **desktop**, this content flows through:
- `SplitPaneLayout` → `ResizablePane` (orientation="horizontal") → first pane
- First pane: `style={{ flex: '0 0 X%' }}` + `overflow-hidden relative min-h-0`
- Then: `<div className="h-full overflow-hidden">{primaryContent}</div>`

The outer `flex flex-col` wrapper on primaryContent with `h-full` children using `flex-shrink-0` creates a height dependency chain. In the flex-row context of ResizablePane, the first pane gets its height from `align-items: stretch`. The `h-full` values cascade. However, the combination of nested `flex flex-col` + `h-full` + `flex-shrink-0` can cause the iframe to collapse to 0 height in certain browser resolution scenarios because the flex-col container doesn't properly propagate height to percentage-based children without an explicit height on the flex container itself.

On **mobile**, the primary content container gets `flex-1` directly, which uses flex-basis: 0 + flex-grow: 1, explicitly allocating space without relying on percentage heights. This always works.

#### Factor 2: Layout remount during hydration

`useMediaQuery` returns `false` during SSR, causing the mobile layout to render first. On desktop, after the useEffect fires, `isDesktop` becomes `true` and the component switches to the desktop layout. This causes the iframe to remount in a different DOM position. While this alone doesn't cause a blank display, it means the PDF.js viewer must reload, and if the height chain is already broken, the viewer renders into a 0-height container.

### Fix Strategy

1. **Fix the primaryContent height chain** in the lesson page to not rely on cascading `h-full` inside a `flex-col` container. Instead, use `flex-1 min-h-0` which properly participates in flex sizing.
2. **Fix the PDFMedia component** to use `min-h-0` to prevent flex container overflow issues and ensure the iframe gets proper dimensions.

## Reuse Inventory

### Existing utilities the plan will reuse
- `cn()` from `@/infra/utils/ui` — conditional className utility (already imported in affected files)
- Existing test patterns from `tests/unit/pdfjs-*.test.ts` — for test structure reference

### Justification for NEW utilities
- None needed. This is a CSS/layout fix only.

---

## Steps

### Step 1: Fix PDF primaryContent height chain in lesson page

**Root Cause**: The lesson page builds `primaryContent` with `<div className="w-full h-full flex flex-col">` wrapping file items that use `h-full flex-shrink-0`. On desktop, this creates a height chain that relies on cascading `h-full` through multiple flex contexts. The `flex-col` container with `h-full` children using percentage heights can collapse when the computed height resolves through multiple nested flex containers in Chrome.

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — lines 150-163)

**Reproduction Test**: Write a component render test that verifies the primaryContent layout renders the PDF iframe with non-zero dimensions in a desktop-like container.

- Test location: `tests/unit/components/PDFMedia.test.tsx`
- What it tests: PDFMedia iframe renders with proper height inside a flex-row container (simulating desktop ResizablePane layout)
- Why it fails: The iframe's container collapses to 0 height due to `h-full` in nested flex-col within flex-row

**Fix**: Change the primaryContent wrapper and file containers to use flex-based sizing instead of percentage-based `h-full`:

**Before** (lines 150-163):
```tsx
const primaryContent = (
    <div className="w-full h-full flex flex-col">
      {validFiles.map((file, index) => (
        <div key={file.id} className="w-full h-full flex-shrink-0">
          {index > 0 && (
            <div className="h-0.5 my-8 flex-shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
          )}
          <div className="border rounded-lg overflow-hidden bg-card shadow-lg h-full">
            <MediaComponent resource={file} className="w-full h-full" htmlElement={null} />
          </div>
        </div>
      ))}
    </div>
  )
```

**After**:
```tsx
const primaryContent = (
    <div className="w-full h-full flex flex-col min-h-0">
      {validFiles.map((file, index) => (
        <div key={file.id} className="w-full flex-1 min-h-0">
          {index > 0 && (
            <div className="h-0.5 my-8 flex-shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
          )}
          <div className="border rounded-lg overflow-hidden bg-card shadow-lg h-full">
            <MediaComponent resource={file} className="w-full h-full" htmlElement={null} />
          </div>
        </div>
      ))}
    </div>
  )
```

Key changes:
- Parent div: Added `min-h-0` to allow flex container to shrink below content intrinsic size
- File wrapper: Changed from `h-full flex-shrink-0` to `flex-1 min-h-0` — this uses flex-grow to allocate space rather than relying on percentage height cascading. `min-h-0` prevents the flex item from expanding beyond available space.

**Verification**:
- Run reproduction test → FAILS (iframe height is 0 with old code)
- After fix applied → PASSES (iframe gets proper height via flex-1)

**Acceptance Criteria**:
- [ ] primaryContent wrapper has `min-h-0` class
- [ ] File wrapper divs use `flex-1 min-h-0` instead of `h-full flex-shrink-0`
- [ ] PDF iframe renders with non-zero height in desktop flex-row layout
- [ ] Mobile layout continues to work (flex-1 works in both contexts)

---

### Step 2: Add min-h-0 to PDFMedia component for robust flex containment

**Root Cause**: The PDFMedia component uses `h-full` on both its wrapper div and the iframe. While `h-full` cascades correctly when all ancestors have explicit heights, adding `min-h-0` to the wrapper ensures it works correctly in nested flex contexts regardless of the parent's height resolution method.

**Files to Touch**:
- `src/ui/web/media/PDFMedia/index.tsx` (MODIFIED — line 44)

**Reproduction Test**: Extend the test from Step 1 to verify PDFMedia renders correctly in a flex container without explicit height.

- Test location: `tests/unit/components/PDFMedia.test.tsx` (same file as Step 1)
- What it tests: PDFMedia wrapper has `min-h-0` class for flex containment
- Why it fails: Without `min-h-0`, the PDFMedia wrapper's min-height defaults to `auto` in flex contexts, which can cause overflow instead of proper containment

**Fix**: Add `min-h-0` to the PDFMedia wrapper div:

**Before** (line 44):
```tsx
<div className={cn('w-full h-full', className)}>
```

**After**:
```tsx
<div className={cn('w-full h-full min-h-0', className)}>
```

**Verification**:
- Run test → FAILS (PDFMedia wrapper missing min-h-0)
- After fix → PASSES (wrapper has min-h-0 class)

**Acceptance Criteria**:
- [ ] PDFMedia wrapper div includes `min-h-0` class
- [ ] Existing PDFMedia functionality preserved (PDF loads, tracking event fires)

---

### Step 3: Add min-h-0 to SplitPaneLayout desktop wrapper for robust height propagation

**Root Cause**: The `SplitPaneLayout` desktop path wraps primaryContent in `<div className="h-full overflow-hidden">`. While `overflow-hidden` implicitly sets min-height: 0 in most cases, adding explicit `min-h-0` ensures the height chain works in all Chrome versions.

**Files to Touch**:
- `src/ui/web/components/split-pane-layout.tsx` (MODIFIED — line 145)

**Reproduction Test**: Verify the desktop wrapper for primary content has min-h-0.

- Test location: `tests/unit/components/PDFMedia.test.tsx` (same file)
- What it tests: SplitPaneLayout desktop path renders primaryContent wrapper with `min-h-0`
- Why it fails: Without explicit `min-h-0`, height might not cascade properly in deep flex nesting

**Fix**: Add `min-h-0` to the desktop primary content wrapper:

**Before** (line 145):
```tsx
<div className="h-full overflow-hidden">{primaryContent}</div>
```

**After**:
```tsx
<div className="h-full overflow-hidden min-h-0">{primaryContent}</div>
```

**Verification**:
- Run test → FAILS (wrapper missing min-h-0)
- After fix → PASSES (wrapper has min-h-0)

**Acceptance Criteria**:
- [ ] Desktop primary content wrapper has `min-h-0` class
- [ ] ResizablePane still renders correctly with updated wrapper
- [ ] Mobile layout unchanged

---

### Step 4: Write comprehensive reproduction test

**Files to Touch**:
- `tests/unit/components/PDFMedia.test.tsx` (NEW)

**Test Plan**:

Create a test file that tests the PDF display in both mobile and desktop layout contexts:

1. **Test: PDFMedia renders iframe with PDF.js viewer URL**
   - Render PDFMedia with a mock media resource
   - Verify the iframe `src` contains `/api/pdfjs-viewer?file=`
   - Verify iframe has `title="PDF Viewer"`

2. **Test: PDFMedia wrapper has min-h-0 for flex containment**
   - Render PDFMedia
   - Verify the wrapper div has `min-h-0` class

3. **Test: PDFMedia renders null when no URL available**
   - Render PDFMedia with resource that has no URL or filename
   - Verify nothing is rendered

4. **Test: primaryContent uses flex-1 min-h-0 for file wrappers (not h-full flex-shrink-0)**
   - This is a code-level assertion test — verify the lesson page template uses the correct classes

**Commands**:
```bash
pnpm vitest run tests/unit/components/PDFMedia.test.tsx
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Tests cover both the component rendering and the CSS class assertions
- [ ] No snapshot or E2E dependencies — pure unit/component tests

---

### Step 5: Verify quality gates

**Commands**:
```bash
pnpm -s tsc --noEmit
pnpm -s lint
pnpm vitest run tests/unit/components/PDFMedia.test.tsx
```

**Acceptance Criteria**:
- [ ] TypeScript compilation passes
- [ ] Lint passes
- [ ] All new tests pass
- [ ] Existing PDF-related tests still pass (`pnpm vitest run tests/unit/pdfjs-*.test.ts tests/unit/pdfjs-*.spec.ts`)
