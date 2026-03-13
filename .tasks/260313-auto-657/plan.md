# Plan: Fix Lesson Introduction Container Width

## Research Findings

- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — The main file containing the narrow container. Line 178 has `max-w-3xl` (768px) which is the root cause.
- ✅ `tailwind.config.mjs` — Tailwind config exists with standard breakpoints. `max-w-6xl` = 1152px, `max-w-7xl` = 1280px are available out-of-the-box.
- ✅ `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/useExercisesPager.ts` — Hook with page states: `intro`, `about`, `exercise`, `outro`.
- ✅ No existing unit/integration tests for ExercisesPager component.
- ✅ E2E test infrastructure exists in `tests/e2e/` with Playwright.

**Patterns observed:**
- The ExercisesPager renders 4 page states: `intro`, `about`, `exercise`, `outro` in a single `<main>` container.
- All non-exercise states (intro, about, outro) share the same outer `<div>` with `max-w-3xl` on line 178.
- The `about` page (which shows the intro description + media) inherits this same narrow container and also constrains inner content with `max-w-md` (448px) on lines 245 and 292.
- The Tailwind container class already provides responsive padding via `tailwind.config.mjs` (1rem default, 2rem at md+).

**Root cause:** Line 178 of `ExercisesPager/index.tsx` sets `max-w-3xl` (768px) on the container wrapping all non-exercise page states. The spec requires 1200–1280px on desktop. Additionally, inner elements use `max-w-md` (448px) which further constrains intro description text.

## Reuse Inventory

- **Existing utilities reused:**
  - Tailwind's built-in `max-w-7xl` class (1280px) — matches spec requirement exactly
  - Tailwind `container` class with theme padding config from `tailwind.config.mjs`
  - `cn()` from `@/utilities/cn` if conditional classes needed (not needed here — straightforward class swap)

- **No new utilities needed** — this is a CSS-only fix using existing Tailwind classes.

---

### Step 1: Widen the outer container from `max-w-3xl` to `max-w-7xl`

**Root Cause**: The outer container on line 178 uses `max-w-3xl` (768px). The spec requires 1200–1280px desktop max-width. `max-w-7xl` = 1280px matches exactly.

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (MODIFIED — line 178)

**Change**:
- Line 178: Replace `max-w-3xl` with `max-w-7xl`
- Current: `<div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-3xl">`
- After: `<div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-7xl">`

**Why `max-w-7xl`**:
- `max-w-7xl` = 1280px — the upper bound of the spec's "1200–1280px" range
- Combined with `container mx-auto`, this centers the content and constrains to 1280px on large screens
- On mobile (< 1280px viewport), the container uses full available width with `px-4` (16px) padding, matching the spec's "16–20px" mobile requirement
- `sm:px-6` (24px) at the sm breakpoint provides slightly more padding on small tablets

**Spec Coverage**: 
- Spec Req "Desktop max-width 1200-1280px" → `max-w-7xl` = 1280px ✅
- Spec Req "Mobile full width with 16-20px padding" → `px-4` = 16px ✅

**Reproduction Test** (E2E — Playwright):
- Test location: `tests/e2e/lesson-intro-width.e2e.spec.ts` (NEW)
- What it tests: The lesson intro/about/outro container has appropriate width on desktop and mobile viewports
- Desktop test: Navigate to a lesson with exercises → verify the intro container has computed max-width of 1280px
- Mobile test: Same page at 375px viewport → verify container uses full width with ~16px padding
- Why it fails before fix: Container has `max-w-3xl` (768px max-width) instead of 1280px

**Acceptance Criteria**:
- [ ] Desktop: Intro container max-width is 1280px (`max-w-7xl`)
- [ ] Mobile: Container uses full available width with 16px (`px-4`) horizontal padding
- [ ] All page states (intro, about, outro) are affected by the change
- [ ] `pnpm tsc --noEmit` passes

---

### Step 2: Widen inner content constraints for about page description

**Root Cause**: Inside the `about` page state, the intro description text uses `max-w-md mx-auto` (448px), which remains overly narrow even after widening the outer container. The image container also has no width constraint and will look better with more space.

**Files to Touch**:
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` (MODIFIED — lines 245, 199, 292)

**Changes**:
1. **Line 245** (about page — SafeHtml intro description): Change `max-w-md` to `max-w-2xl`
   - Current: `className="prose-lg max-w-md mx-auto mb-8 text-muted-foreground leading-relaxed text-start [&_ul]:list-inside [&_ol]:list-inside"`
   - After: `className="prose-lg max-w-2xl mx-auto mb-8 text-muted-foreground leading-relaxed text-start [&_ul]:list-inside [&_ol]:list-inside"`
   - Rationale: `max-w-2xl` (672px) provides a good reading width for prose content within the wider container. Full width prose becomes hard to read.

2. **Line 199** (intro page — description paragraph): Change `max-w-md` to `max-w-2xl`
   - Current: `className="text-muted-foreground mb-10 text-base leading-relaxed max-w-md mx-auto"`
   - After: `className="text-muted-foreground mb-10 text-base leading-relaxed max-w-2xl mx-auto"`

3. **Line 292** (outro page — description paragraph): Change `max-w-md` to `max-w-2xl`
   - Current: `className="text-muted-foreground mb-10 text-base leading-relaxed max-w-md mx-auto"`
   - After: `className="text-muted-foreground mb-10 text-base leading-relaxed max-w-2xl mx-auto"`

**Why `max-w-2xl` (672px) and not wider**: Prose text becomes difficult to read when lines exceed ~75 characters. `max-w-2xl` (672px) at base font size keeps line lengths in the 65-80 character optimal range while being substantially wider than the current 448px.

**Spec Coverage**:
- Spec Req "Content displays in a readable layout without unnecessary narrow spacing" → wider inner content ✅

**Reproduction Test** (extends Step 1 E2E):
- Same test file: `tests/e2e/lesson-intro-width.e2e.spec.ts`
- Additional assertion: Verify intro description text area is wider than 448px on desktop (should be ~672px)
- Why it fails before fix: `max-w-md` constrains description to 448px

**Acceptance Criteria**:
- [ ] Intro description text is constrained to `max-w-2xl` (672px) — wider than before but still readable
- [ ] About page SafeHtml prose content uses `max-w-2xl`
- [ ] Outro description text uses `max-w-2xl`
- [ ] Content is readable and not stretched too wide
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
