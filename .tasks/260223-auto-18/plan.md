# Plan: 260223-auto-18 — RTL Logical CSS Refactor

## Summary

Refactor ~25 frontend components to replace physical directional Tailwind CSS classes with RTL-aware logical equivalents. The project is RTL-first (Hebrew), so using physical classes (`ml-`, `mr-`, `left-`, `right-`, etc.) causes incorrect spacing in RTL mode. This plan groups files by domain into 6 steps, each independently testable.

## Assumptions

1. `src/ui/cody/` components are in-scope since they are frontend components (not Payload admin).
2. The `border-r-transparent` on Spinner.tsx is a **visual trick** (makes one side of a circle border invisible to create a spinner arc) — it is NOT a directional layout class and must NOT be changed. The spec guardrails say "Do NOT alter" anything that isn't directional layout.
3. Dialog centering classes (`left-[50%]`, `translate-x-[-50%]`, `slide-out-to-left-1/2`, `slide-in-from-left-1/2`) are for absolute centering via transform and are NOT directional layout — they must NOT be changed.
4. CommandPalette centering (`left-1/2`, `-translate-x-1/2`) is the same centering pattern — NOT changed.
5. Animation data-attributes (`data-[side=left]:slide-in-from-right-2`, etc.) in dropdown-menu.tsx and select.tsx are Radix UI animation directives — these are side-aware but come from the library and should use `ltr:/rtl:` variant prefixes only if there's a directional concern. For this refactor, these are **out of scope** since they are animation hints tied to Radix side props, not layout.
6. The `isHebrew ? 'ml-auto' : 'mr-auto'` pattern in ExerciseRenderer already handles RTL manually — replacing with a single `ms-auto` is the correct logical equivalent.
7. Chat bubble corner rounding (`rounded-bl-[4px]`, `rounded-br-[4px]`) IS directional and needs logical equivalents (`rounded-es-[4px]`, `rounded-ee-[4px]`).

## Test Strategy

For this CSS class refactor, we write **snapshot/regex-based tests** that scan source files for remaining physical classes. This is more effective than rendering tests because:
- The changes are purely mechanical class replacements
- A grep-based test catches ALL violations across the entire codebase
- It serves as a permanent regression guard

We also write a few targeted render tests for complex components (chat, exercise renderer) to verify correct class output.

---

### Step 1: Create RTL lint test + utility mapping (15 min)

**Files to Touch**:
- `tests/unit/rtl-logical-classes.test.ts` (NEW - UPDATE SCOPE)

**Behavior**: A test file that scans all `src/ui/web/**/*.tsx`, `src/ui/cody/**/*.tsx`, and `src/app/(frontend)/**/*.tsx` files for physical directional Tailwind classes that should be logical. It maintains an allowlist for exceptions (centering patterns, spinner border trick, Radix animation attributes, and specific fixed offsets).

**Behavior**: A test file that scans all `src/ui/web/**/*.tsx`, `src/ui/cody/**/*.tsx`, and `src/app/(frontend)/**/*.tsx` files for physical directional Tailwind classes that should be logical. It maintains an allowlist for exceptions (centering patterns, spinner border trick, Radix animation attributes, and specific fixed offsets).

**Tests** (MUST FAIL before refactor, PASS after):
1. `should not contain physical margin classes (ml-/mr-) in frontend components` — scans files for `\bml-\d`, `\bmr-\d`, `\b-ml-`, `\b-mr-` excluding allowlisted patterns. Fails now because ~15+ files contain these.
2. `should not contain physical padding classes (pl-/pr-) in frontend components` — scans for `\bpl-\d`, `\bpr-\d`. Fails now because ~5 files contain these.
3. `should not contain physical positioning classes (left-/right-) except centering and fixed offsets` — scans for `\bleft-\d`, `\bright-\d`, `\b-left-`, `\b-right-` excluding `left-[50%]`, `left-1/2`, `right-4`, `left-2`. Fails now.
4. `should not contain physical text alignment (text-left/text-right)` — scans for `\btext-left\b`, `\btext-right\b`. Fails now.
5. `should not contain physical border/rounded directional classes` — scans for `\bborder-l-`, `\bborder-r-`, `\brounded-bl-`, `\brounded-br-`, `\brounded-tl-`, `\brounded-tr-`, `\brounded-l-`, `\brounded-r-`. Fails now.
6. `should not contain physical float/clear classes` — scans for `\bfloat-left\b`, `\bfloat-right\b`, `\bclear-left\b`, `\bclear-right\b`. Passes now (none found in current codebase).
7. `should not contain directional gradients (bg-gradient-to-r/l) or physical X-axis transforms (translate-x-*) without ltr:/rtl: variants` — scans for `\bbg-gradient-to-(l|r)\b`, `\btranslate-x-[^-]*\b` excluding `translate-x-0`, `translate-x-full`, `-translate-x-1`, `translate-x-1`, and `data-[side=...]:translate-x-*` patterns. Fails now if non-excluded instances exist.
4. `should not contain physical text alignment (text-left/text-right)` — scans for `\btext-left\b`, `\btext-right\b`. Fails now.
5. `should not contain physical border/rounded directional classes` — scans for `\bborder-l-`, `\bborder-r-`, `\brounded-bl-`, `\brounded-br-`, `\brounded-tl-`, `\brounded-tr-`, `\brounded-l-`, `\brounded-r-`. Fails now.

**Allowlist** (classes that must NOT be changed):
- `border-r-transparent` in Spinner.tsx (visual arc for spinner animation, NOT directional layout)
- `left-[50%]`, `translate-x-[-50%]` (CSS centering pattern for modals)
- `left-1/2`, `-translate-x-1/2` (CSS centering pattern for CommandPalette, PlanCard, ExerciseHeader)
- `right-4`, `top-4` (absolute positioning for elements like dialog close buttons, PRESERVED per spec FR-003 exception)
- `left-2` (positioning for icons inside input/button elements, PRESERVED per spec FR-003 exception)
- `slide-out-to-left-1/2`, `slide-in-from-left-1/2` (Radix UI animation keyframes)
- `data-[side=left]:*`, `data-[side=right]:*` (Radix UI side-aware animation directives)
- `translate-x-0`, `-translate-x-1`, `translate-x-1` (non-directional transforms or Radix UI internal positioning)

**Acceptance Criteria**:
- [ ] Test file exists and all 5 tests FAIL (red) before any component changes
- [ ] Allowlist correctly excludes non-directional patterns
- [ ] Test covers both `src/ui/web/` and `src/ui/cody/` directories

---

### Step 2: Refactor shared UI components and shadcn primitives (20 min)

**Requirement refs**: FR-001, FR-002, FR-003, FR-004, FR-005

**Files to Touch**:
- `src/ui/web/components/pagination.tsx` (MODIFIED — lines 52, 64)
  - `pl-2.5` → `ps-2.5`
  - `pr-2.5` → `pe-2.5`
- `src/ui/web/components/dialog.tsx` (MODIFIED — lines 53, 64)
   - `right-4` (CLOSE BUTTON - PRESERVED per spec FR-003 exception)
  - `sm:text-left` → `sm:text-start`
  - **DO NOT CHANGE**: `left-[50%]`, `translate-x-[-50%]`, `slide-*` (centering)
- `src/ui/web/components/command.tsx` (MODIFIED — lines 29, 108)
  - `mr-2` → `me-2`
  - `ml-auto` → `ms-auto`
- `src/ui/web/components/dropdown-menu.tsx` (MODIFIED — lines 31, 37, 85, 100, 106, 123, 128, 146, 165)
  - `pl-8` → `ps-8` (4 occurrences)
  - `ml-auto` → `ms-auto` (2 occurrences)
  - `pl-8 pr-2` → `ps-8 pe-2` (2 occurrences for CheckboxItem/RadioItem)
  - `left-2` → `start-2` (2 occurrences for indicator spans)
- `src/ui/web/components/select.tsx` (MODIFIED — lines 95, 108, 114)
  - `pl-8 pr-2` → `ps-8 pe-2` (2 occurrences)
  - `left-2` → `start-2` (1 occurrence)

**Tests** (from Step 1 test file):
1. After this step, the shadcn primitive files should have zero physical directional violations
2. `should not contain physical padding classes in frontend components` — reduces violations

**Acceptance Criteria**:
- [ ] `pagination.tsx`: `pl-2.5` → `ps-2.5`, `pr-2.5` → `pe-2.5`
- [ ] `dialog.tsx`: `right-4` PRESERVED, `sm:text-left` → `sm:text-start`
- [ ] `command.tsx`: `mr-2` → `me-2`, `ml-auto` → `ms-auto`
- [ ] `dropdown-menu.tsx`: all `pl-`→`ps-`, `pr-`→`pe-`, `ml-auto`→`ms-auto`, `left-2`→`start-2`
- [ ] `select.tsx`: all `pl-`→`ps-`, `pr-`→`pe-`, `left-2`→`start-2`
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes

---

### Step 3: Refactor header, auth, and utility components (15 min)

**Requirement refs**: FR-001, FR-003, FR-004, FR-007

**Files to Touch**:
- `src/ui/web/header/MobileMenu/index.tsx` (MODIFIED — line 65)
  - `right-0` → `end-0`
  - `border-l` → `border-s`
  - `translate-x-0` and `translate-x-full` — these control the slide animation. For RTL, the menu should slide from the start side. Replace with `ltr:translate-x-0 rtl:-translate-x-0` / `ltr:translate-x-full rtl:-translate-x-full` — actually since `translate-x-0` is zero and `translate-x-full` slides it off-screen to the right, with `end-0` positioning this should work correctly as-is. **Keep `translate-x-0` and `translate-x-full` unchanged** since they work with the `end-0` logical position.
- `src/ui/web/providers/Theme/ThemeSelector/index.tsx` (MODIFIED — line 40)
  - `pl-0 md:pl-3` → `ps-0 md:ps-3`
- `src/ui/web/auth/GoogleLoginButton.tsx` (MODIFIED — line 40)
  - `mr-2` → `me-2`
- `src/ui/web/UserDropdown/index.tsx` (MODIFIED — line 56)
  - `mr-2` → `me-2`
- `src/ui/web/components/HealthBadge.tsx` (MODIFIED — line 89)
  - `ml-2` → `ms-2`
- `src/ui/web/shared/TypingAnimation/index.tsx` (MODIFIED — line 33)
  - `ml-1` → `ms-1`
- `src/ui/web/CommandPalette.tsx` (MODIFIED — lines 58, 62, 71, 77)
  - `mr-2` → `me-2` (4 icon occurrences)
  - **DO NOT CHANGE**: `left-1/2`, `-translate-x-1/2` (centering)

**Tests**:
1. Step 1 tests: `ml-`/`mr-`/`pl-`/`right-`/`border-l` violations reduce after this step
2. Additional targeted test: `MobileMenu should use logical border-s instead of border-l` — render MobileMenu, check output contains `border-s` not `border-l`

**Acceptance Criteria**:
- [ ] MobileMenu: `right-0` → `end-0`, `border-l` → `border-s`
- [ ] ThemeSelector: `pl-0 md:pl-3` → `ps-0 md:ps-3`
- [ ] GoogleLoginButton: `mr-2` → `me-2`
- [ ] UserDropdown: `mr-2` → `me-2`
- [ ] HealthBadge: `ml-2` → `ms-2`
- [ ] TypingAnimation: `ml-1` → `ms-1`
- [ ] CommandPalette: all `mr-2` → `me-2`
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes

---

### Step 4: Refactor exercise renderer components (20 min)

**Requirement refs**: FR-001, FR-005, FR-004

**Files to Touch**:
- `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` (MODIFIED — line 295)
  - `isHebrew ? 'ml-auto' : 'mr-auto'` → `'ms-auto'` (logical property handles both directions automatically)
- `src/ui/web/exerciserenderer/components/QuestionCard/index.tsx` (MODIFIED — lines 58-59, 82, 87)
  - `text-right` → `text-end`
  - `text-left` → `text-start`
  - `mr-2` → `me-2` (2 occurrences: Loader2 icon, CheckCircle2 icon)
- `src/ui/web/exerciserenderer/questions/TableQuestion/ExerciseTable.tsx` (MODIFIED — lines 47, 132, 134)
  - `text-left` → `text-start` (in alignClass map and conditionals)
  - `text-right` → `text-end` (in alignClass map and conditionals)
- `src/ui/web/exerciserenderer/questions/TableQuestion/index.tsx` (MODIFIED — line 95)
  - `mr-2` → `me-2`
- `src/ui/web/exerciserenderer/answers/TrueFalseAnswerUI/index.tsx` (MODIFIED — line 66)
  - `ml-2` → `ms-2`

**Tests**:
1. Step 1 lint test: `text-left`/`text-right` violations eliminated from exercise renderer
2. Targeted test: `ExerciseRenderer should use ms-auto instead of conditional ml/mr-auto` — verify the rendered output contains `ms-auto` and NOT `ml-auto` or `mr-auto`

**Acceptance Criteria**:
- [ ] ExerciseRenderer: conditional `ml-auto`/`mr-auto` replaced with single `ms-auto`
- [ ] QuestionCard: `text-right` → `text-end`, `text-left` → `text-start`, `mr-2` → `me-2`
- [ ] ExerciseTable: alignment map uses `text-start`/`text-end`
- [ ] TableQuestion: `mr-2` → `me-2`
- [ ] TrueFalseAnswerUI: `ml-2` → `ms-2`
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes

---

### Step 5: Refactor chat components (20 min)

**Requirement refs**: FR-001, FR-003, FR-004, FR-005

**Files to Touch**:
- `src/ui/web/chat/ChatInterface/index.tsx` (MODIFIED — lines 366, 382, 383, 440, 493)
  - `mr-2` → `me-2` (Loader2 icon, line 366)
  - `ml-auto` → `ms-auto` (user message, line 382)
  - `rounded-bl-[4px]` → `rounded-es-[4px]` (user message bubble corner, line 382)
  - `mr-auto` → `me-auto` (assistant message, line 383)
  - `rounded-br-[4px]` → `rounded-ee-[4px]` (assistant message bubble corner, line 383)
  - `mr-auto` → `me-auto` (loading indicator, line 440)
  - `rounded-br-[4px]` → `rounded-ee-[4px]` (loading indicator corner, line 440)
  - `left-5 right-5` → `start-5 end-5` (math preview popup, line 493)

**Tests**:
1. Step 1 lint test: `ml-auto`/`mr-auto`/`rounded-bl-`/`rounded-br-`/`left-`/`right-` violations eliminated from chat
2. Targeted test: `ChatInterface should use logical classes for message bubbles` — verify user messages use `ms-auto rounded-es-[4px]` and assistant messages use `me-auto rounded-ee-[4px]`

**Acceptance Criteria**:
- [ ] User messages: `ml-auto` → `ms-auto`, `rounded-bl-[4px]` → `rounded-es-[4px]`
- [ ] Assistant messages: `mr-auto` → `me-auto`, `rounded-br-[4px]` → `rounded-ee-[4px]`
- [ ] Loading indicator: `mr-auto` → `me-auto`, `rounded-br-[4px]` → `rounded-ee-[4px]`
- [ ] Math preview: `left-5 right-5` → `start-5 end-5`
- [ ] Loader2 icon: `mr-2` → `me-2`
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes

---

### Step 6: Refactor Cody components + Typography + final sweep (20 min)

**Requirement refs**: FR-001, FR-003, FR-004, FR-005

**Requirement refs**: FR-001, FR-003, FR-004, FR-005

**Files to Touch**:
- `src/ui/web/shared/Typography/Text.tsx` (MODIFIED — lines 42, 44)
  - `text-left` → `text-start`
  - `text-right` → `text-end`
- `src/ui/web/shared/Typography/Heading.tsx` (MODIFIED — lines 33, 35)
  - `text-left` → `text-start`
  - `text-right` → `text-end`
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — lines 208, 220, 261)
  - `border-l` → `border-s`
  - `text-left` → `text-start`
  - `ml-2` → `ms-2`
- `src/ui/cody/components/CommentBox.tsx` (MODIFIED — line 64)
  - `ml-auto` → `ms-auto`
- `src/ui/cody/components/CommentList.tsx` (MODIFIED — line 76)
  - `ml-1` → `ms-1`
- `src/ui/cody/components/LabelPicker.tsx` (MODIFIED — line 136)
  - `ml-auto` → `ms-auto`
- `src/ui/cody/components/AssigneePicker.tsx` (MODIFIED — line 123)
  - `ml-auto` → `ms-auto`
- `src/ui/cody/components/CommentEditor.tsx` (MODIFIED — lines 379, 441, 463)
  - `left-0` → `start-0`
  - `text-left` → `text-start`
  - `ml-auto` → `ms-auto`
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — line 312)
  - `border-l` → `border-s`

**Tests**:
1. Step 1 lint test: ALL 5 test cases now PASS (zero physical directional class violations)
2. `Typography Text and Heading should map alignment to logical classes` — verify `left` alignment prop outputs `text-start` and `right` outputs `text-end`

**Acceptance Criteria**:
- [ ] Typography Text/Heading: `text-left` → `text-start`, `text-right` → `text-end`
- [ ] CodyChat: `border-l` → `border-s`, `text-left` → `text-start`, `ml-2` → `ms-2`
- [ ] CommentBox: `ml-auto` → `ms-auto`
- [ ] CommentList: `ml-1` → `ms-1`
- [ ] LabelPicker: `ml-auto` → `ms-auto`
- [ ] AssigneePicker: `ml-auto` → `ms-auto`
- [ ] CommentEditor: `left-0` → `start-0`, `text-left` → `text-start`, `ml-auto` → `ms-auto`
- [ ] CodyDashboard: `border-l` → `border-s`
- [ ] ALL Step 1 lint tests PASS (zero violations)
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes
- [ ] Lint passes: `pnpm lint` passes

---

### Step 7: Refactor frontend app components and handle gradients/transforms (25 min)

**Requirement refs**: FR-001, FR-002, FR-003, FR-004, FR-007

**Files to Touch**:
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (MODIFIED — line 70)
  - `mr-2` → `me-2`
- `src/app/(frontend)/courses/_components/BackToCourses/index.tsx` (MODIFIED — line 30)
  - `pl-0` → `ps-0`
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ViewToggle.tsx` (MODIFIED — line 49)
  - `mr-2` → `me-2`
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/NotebookWorkspace/index.tsx` (MODIFIED — lines 78, 80, 81)
  - `ml-6` → `ms-6`
  - `right-0` → `end-0`
  - `border-l` → `border-s`
  - `lg:translate-x-0` → `ltr:lg:translate-x-0 rtl:lg:-translate-x-0`
  - `translate-x-0` (line 80) → `ltr:translate-x-0 rtl:-translate-x-0`
  - `translate-x-full` (line 81) → `ltr:translate-x-full rtl:-translate-x-full`
- `src/app/(frontend)/ask/_components/AskContent/index.tsx` (MODIFIED — line 118)
  - `mr-2` → `me-2`
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (MODIFIED — line 143)
  - `bg-gradient-to-r` → `ltr:bg-gradient-to-r rtl:bg-gradient-to-l`

**Tests**:
1. Step 1 lint test: After this step, all tests should PASS, confirming zero physical directional classes.
2. Targeted render tests for `NotebookWorkspace` to verify correct sliding animation in both LTR and RTL.

**Acceptance Criteria**:
- [ ] CourseCard: `mr-2` → `me-2`
- [ ] BackToCourses: `pl-0` → `ps-0`
- [ ] ViewToggle: `mr-2` → `me-2`
- [ ] NotebookWorkspace: `ml-6` → `ms-6`, `right-0` → `end-0`, `border-l` → `border-s`, `translate-x-*` updated with `ltr:/rtl:`
- [ ] AskContent: `mr-2` → `me-2`
- [ ] page.tsx: `bg-gradient-to-r` → `ltr:bg-gradient-to-r rtl:bg-gradient-to-l`
- [ ] ALL Step 1 lint tests PASS (zero violations)
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes
- [ ] Lint passes: `pnpm lint` passes

---

## Mapping Reference (for build agent)

| Physical Class | Logical Equivalent | Notes |
|---|---|---|
| `ml-*` | `ms-*` | margin-inline-start |
| `mr-*` | `me-*` | margin-inline-end |
| `-ml-*` | `-ms-*` | negative margin-inline-start |
| `-mr-*` | `-me-*` | negative margin-inline-end |
| `pl-*` | `ps-*` | padding-inline-start |
| `pr-*` | `pe-*` | padding-inline-end |
| `left-*` | `start-*` | inset-inline-start |
| `right-*` | `end-*` | inset-inline-end |
| `-left-*` | `-start-*` | negative inset-inline-start |
| `-right-*` | `-end-*` | negative inset-inline-end |
| `text-left` | `text-start` | text-align: start |
| `text-right` | `text-end` | text-align: end |
| `border-l-*` | `border-s-*` | border-inline-start |
| `border-r-*` | `border-e-*` | border-inline-end |
| `border-l` | `border-s` | border-inline-start (1px) |
| `border-r` | `border-e` | border-inline-end (1px) |
| `rounded-l-*` | `rounded-s-*` | border-start-radius |
| `rounded-r-*` | `rounded-e-*` | border-end-radius |
| `rounded-tl-*` | `rounded-ss-*` | border-start-start-radius |
| `rounded-tr-*` | `rounded-se-*` | border-start-end-radius |
| `rounded-bl-*` | `rounded-es-*` | border-end-start-radius |
| `rounded-br-*` | `rounded-ee-*` | border-end-end-radius |
| `float-left` | `float-start` | float: inline-start |
| `float-right` | `float-end` | float: inline-end |
| `clear-left` | `clear-start` | clear: inline-start |
| `clear-right` | `clear-end` | clear: inline-end |

## DO NOT CHANGE (Allowlist)

| Pattern | File | Reason |
|---|---|---|
| `border-r-transparent` | Spinner.tsx | Visual arc for spinner animation, NOT directional layout |
| `left-[50%]`, `translate-x-[-50%]` | dialog.tsx | CSS centering pattern for modals |
| `left-1/2`, `-translate-x-1/2` | CommandPalette.tsx, PlanCard/index.tsx, ExerciseHeader/index.tsx | CSS centering pattern |
| `right-4`, `top-4` | dialog.tsx | Fixed positioning for dialog close button (PRESERVED per spec FR-003 exception) |
| `left-2` | dropdown-menu.tsx, select.tsx | Fixed positioning for icons within input/button elements (PRESERVED per spec FR-003 exception) |
| `slide-out-to-left-*`, `slide-in-from-left-*` | dialog.tsx | Radix UI animation keyframes |
| `data-[side=left]:*`, `data-[side=right]:*` | dropdown-menu.tsx, select.tsx | Radix UI side-aware animation directives |
| `translate-x-0` | MobileMenu/index.tsx | Works with `end-0` logical positioning |
| `translate-x-full` | MobileMenu/index.tsx | Works with `end-0` logical positioning |
| `translate-x-0` | NotebookWorkspace/index.tsx | Directional transform needs `ltr:/rtl:` variants (addressed in Step 7) |
| `translate-x-full` | NotebookWorkspace/index.tsx | Directional transform needs `ltr:/rtl:` variants (addressed in Step 7) |
| `-translate-x-1`, `translate-x-1` | select.tsx | Radix UI side positioning |
| `rounded-lg`, `rounded-md`, `rounded-sm`, `rounded-xl`, `rounded-full` | various | Non-directional (all corners) |
| `flex-row-reverse` | QuestionCard | Layout flip, not physical direction |
| `bg-gradient-to-r` | page.tsx | Directional gradient needs `ltr:bg-gradient-to-r rtl:bg-gradient-to-l` (addressed in Step 7) |
| `border-l` | NotebookWorkspace/index.tsx | Needs to be `border-s` for sidebar (addressed in Step 7) |

## Quality Gates

After all steps:
1. `pnpm tsc --noEmit` — TypeScript compiles
2. `pnpm lint` — No lint violations
3. `pnpm vitest run tests/unit/rtl-logical-classes.test.ts` — All 5 scan tests pass
4. `pnpm vitest run` — All existing tests still pass (no regressions)
