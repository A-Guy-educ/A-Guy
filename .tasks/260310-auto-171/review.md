# Code Review: Course Studying Page UI Redesign (260310-auto-171)

## Summary

The implementation creates a new study page variant at `/courses/.../study` with mode-based theming (Study/Hint/Practice/Test), glassmorphism design tokens, a contextual sidebar, and slide-in chat panel. The design token infrastructure and i18n work is solid. However, several critical runtime bugs, missing functionality, and logic errors need to be addressed before this code is shippable.

---

## Critical Issues

### C-01: `document.body` accessed during SSR in ChatSlidePanel (runtime crash)
**File:** `src/ui/web/components/studying-workspace/ChatSlidePanel.tsx:36`
```tsx
const isRtl = document.body.dir === 'rtl'
```
This line runs during the component's render phase (not inside a `useEffect` or `useState` initializer with `typeof window` guard). On SSR or during hydration, `document` is undefined, causing a **runtime crash**. Must be moved into state initialized inside `useEffect` or guarded with `typeof window !== 'undefined'`.

### C-02: Broken framer-motion slide animation values
**File:** `src/ui/web/components/studying-workspace/ChatSlidePanel.tsx:53-55`
```tsx
initial={prefersReducedMotion ? {} : { x: `100%${slideFrom}` }}
```
The expression `100%${slideFrom}` produces strings like `"100%-right"` or `"100%-left"`, which are invalid CSS transform values. framer-motion cannot interpret these. The correct approach would be `{ x: isRtl ? '-100%' : '100%' }` for the initial/exit states.

### C-03: `data-study-mode` set on `document.body` but also on inner div — CSS variable scoping conflict
**File:** `src/ui/web/providers/StudyMode/index.tsx:65` and `src/ui/web/components/studying-workspace/index.tsx:84`
The `StudyModeProvider` sets `data-study-mode` on `document.body` (line 65), while `StudyingWorkspaceInner` also sets `data-study-mode` on its wrapper div (line 84). On initial mount, the `useEffect` is skipped (`isInitialMount` check on line 59), so the body attribute is NOT set during the initial render — meaning CSS custom properties won't resolve on the body. Meanwhile, the inner div does set the attribute, but all children using `glass-surface` and `bg-mode-*` with `fixed` positioning (e.g., `ContentCanvas:30`, `ChatSlidePanel:42-48`) are positioned relative to the viewport, not the scoped div, so they will NOT inherit the CSS variables. This creates **invisible glassmorphism elements** and broken mode coloring on first load and on fixed-positioned elements.

### C-04: Hebrew i18n translation structure mismatch — will cause missing translations
**File:** `src/i18n/he.json:544-546`
The Hebrew `practiceCard` is a flat string `"הפוך כרטיס"` instead of a nested object matching the English structure:
```json
// en.json (correct structure)
"practiceCard": { "flip": "Flip card", "front": "Question", "back": "Answer" }

// he.json (broken)
"practiceCard": "הפוך כרטיס",
"front": "שאלה",
"back": "תשובה",
```
In Hebrew, `t('practiceCard.flip')` will return the key string `"studyMode.practiceCard.flip"` instead of a translation. The `front` and `back` keys are orphaned at the `studyMode` level rather than nested under `practiceCard`. This also affects the TestModeGuard dialog (line 99) which uses `t('practiceCard.front')` as a button label.

---

## Major Issues

### M-01: Missing React import in StudyingSidebar
**File:** `src/ui/web/components/studying-sidebar/index.tsx:34,36,174`
The file uses `React.useState` (line 34) and `React.useEffect` (line 36) but the `import * as React from 'react'` is at **line 174** — the last line of the file, after the component definition and export. While JavaScript hoists `import` statements, this is a confusing anti-pattern and likely a copy-paste error. More critically, this indicates the code may not have been tested.

### M-02: Scroll position save/restore is a no-op
**File:** `src/ui/web/components/studying-workspace/index.tsx:63-74`
Both `useEffect` hooks for saving and restoring scroll position depend on `[mode]`. When `mode` changes:
1. The **save** effect runs with the **new** mode value (not the old one), so it saves the scroll position under the new mode key before the user has scrolled in that mode.
2. The **restore** effect also runs with the new mode, attempting to restore a position that was just (incorrectly) saved.

The save effect should run as a **cleanup function** triggered before the mode changes, or use a `ref` to track the previous mode.

### M-03: TestModeGuard dialog buttons have wrong labels
**File:** `src/ui/web/components/studying-workspace/TestModeGuard.tsx:93,99`
The "Exit" button uses `t('testMode.test').toUpperCase()` which renders **"TEST"** (or Hebrew **"מבחן"**), and the "Cancel" button uses `t('practiceCard.front')` which renders **"Question"**. These are semantically wrong. The buttons should use proper labels like "Leave Test" / "Cancel" or "Stay". This appears to be a bug where incorrect translation keys were used.

### M-04: `showConfirmDialog` state is set but never triggered
**File:** `src/ui/web/components/studying-workspace/TestModeGuard.tsx:22-48`
The `showConfirmDialog` state is initialized to `false` and `setShowConfirmDialog` is defined, but it is **never called with `true`**. The `popstate` handler (line 42-45) calls `window.history.forward()` instead of showing the dialog. The `beforeunload` handler uses the browser's native dialog. As a result, the custom confirmation dialog JSX (lines 65-104) is **dead code** — it will never render.

### M-05: Hardcoded strings in MobileNavTrigger
**File:** `src/ui/web/components/studying-workspace/index.tsx:142`
```tsx
aria-label="Open chat"
```
This is a hardcoded English string, violating FR-024 (all user-facing strings must be translatable). Should use `t('chat.slideIn')`.

### M-06: WorkspaceHeader back button has wrong aria-label
**File:** `src/ui/web/components/studying-workspace/WorkspaceHeader.tsx:53`
```tsx
aria-label={t('sidebar.expand')}
```
The back button uses the "Expand sidebar" translation as its aria-label. This should be a "Go back" or similar translation key.

### M-07: Content Canvas gradient overlay covers entire viewport
**File:** `src/ui/web/components/studying-workspace/ContentCanvas.tsx:30`
```tsx
<div className="fixed inset-0 bg-gradient-to-br from-mode-surface/30 via-transparent to-transparent pointer-events-none" />
```
This `fixed inset-0` div is placed **inside** the scrollable canvas, which means:
1. It covers the **entire viewport** including sidebar, header, and chat panel
2. It re-renders with every content change
3. Being inside a `motion.div` with `max-w-4xl`, the fixed positioning breaks out of the container context

This should either be `absolute` within a `relative` container, or moved to the workspace level.

### M-08: `lessonId` prop passed to StudyingWorkspace but unused
**File:** `src/ui/web/components/studying-workspace/index.tsx:24,34`
The `lessonId` prop is declared in `StudyingWorkspaceProps` and passed through, but `StudyingWorkspaceInner` destructures props and `lessonId` is **not used** anywhere in the component. While not a runtime error, it suggests the chat session scoping by lesson (FR-014) is not properly wired.

### M-09: Duplicate exercise data fetch in page and generateMetadata
**File:** `src/app/(frontend)/courses/.../study/page.tsx:34-37,144-147`
Both `StudyPage` and `generateMetadata` independently call `queryCourseBySlug` and `queryLessonBySlug`, duplicating the same DB queries. While React's `cache()` deduplicates within a single request, this pattern is unnecessarily verbose. The validation logic (lines 43-56 and 155-172) is also fully duplicated.

### M-10: Timer `sessionStorage` not scoped per test session
**File:** `src/ui/web/components/studying-workspace/TestModeTimer.tsx:30`
```tsx
const saved = sessionStorage.getItem('test-timer')
```
The key `'test-timer'` is static. If a user takes multiple tests (different lessons/courses), they'll share the same timer state. The key should include lesson/exercise ID for proper scoping.

---

## Minor Issues

### m-01: `prefers-reduced-motion` check in ModeButton is stale
**File:** `src/ui/web/components/study-mode-toggle/index.tsx:27-29`
The reduced motion preference is read once in a `useState` initializer and never updated. If the user changes their OS setting while the page is open, the component won't respond. The `ChatSlidePanel` correctly uses `addEventListener('change')` for this (line 30-32) — the pattern should be consistent.

### m-02: Missing `AnimatePresence` wrapper for ChatSlidePanel exit animation
**File:** `src/ui/web/components/studying-workspace/index.tsx:108-112`
The `AnimatePresence` wrapping is correct here, but the `ChatSlidePanel` component itself doesn't use `exit` prop with valid values (see C-02). Even if C-02 is fixed, the `motion.div` inside `ChatSlidePanel` needs valid `exit` animation values to work with `AnimatePresence`.

### m-03: Sidebar collapsed button order is LTR-specific
**File:** `src/ui/web/components/studying-sidebar/index.tsx:87`
```tsx
{isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
```
In RTL layouts, the chevron direction should be reversed. `ChevronRight` should be used when collapsed in LTR, but `ChevronLeft` when collapsed in RTL. The component doesn't account for text direction.

### m-04: `SidebarItem` uses `role="tab"` without a `tabpanel`
**File:** `src/ui/web/components/studying-sidebar/SidebarItem.tsx:45`
Individual sidebar items use `role="tab"` but there's no corresponding `role="tabpanel"` in the content area. These items represent navigation targets, not tabs. More appropriate: `role="treeitem"` within a `role="tree"`, or just use `<a>`/`<Link>` elements with `aria-current`.

### m-05: Multiple `role="tab"` semantic conflicts
**File:** `src/ui/web/components/study-mode-toggle/index.tsx:44` and `src/ui/web/components/studying-sidebar/SidebarItem.tsx:45`
Both the mode toggle buttons and sidebar items use `role="tab"`, creating semantic confusion. The mode toggle is correctly modeled as tabs. The sidebar items should use a different role (e.g., navigation items or tree items).

### m-06: `TestModeTimer` safe-area padding at bottom instead of top
**File:** `src/ui/web/components/studying-workspace/TestModeTimer.tsx:161`
```tsx
<div className="pb-[env(safe-area-inset-bottom)]" />
```
The timer is positioned at the top-right (`fixed top-20 end-4`, workspace line 117). The safe-area padding should be for the **top** inset, not the bottom, matching the spec (FR-031).

### m-07: Timer `aria-live="polite"` announces on every second
**File:** `src/ui/web/components/studying-workspace/TestModeTimer.tsx:103`
The timer container has `aria-live="polite"` with `aria-atomic="true"`. Since the timer updates every second, screen readers will attempt to announce the time every second. Per the plan (Step 10), announcements should be at 5-minute intervals only.

### m-08: `window.location.href` used for navigation
**File:** `src/ui/web/components/studying-workspace/WorkspaceHeader.tsx:32`
```tsx
window.location.href = backUrl
```
This triggers a full page reload, bypassing Next.js client-side navigation. Should use `useRouter().push()` or the `Link` component for SPA navigation.

### m-09: `motion.button` in SidebarItem adds unnecessary wrapper
**File:** `src/ui/web/components/studying-sidebar/SidebarItem.tsx:36`
The `SidebarItem` uses `motion.button` but no animation props are defined on it (no `initial`, `animate`, `exit`, `whileHover`, etc.). This adds framer-motion overhead with no visual benefit. Use a regular `<button>` element.

### m-10: Inconsistent Suspense boundary for useSearchParams
**File:** `src/ui/web/providers/StudyMode/index.tsx:26`
`useSearchParams()` in the `StudyModeProvider` requires a `<Suspense>` boundary in Next.js 14+ when used in client components during static rendering. Without it, this can cause a build warning or error. The component should either be wrapped in Suspense or use a fallback pattern.

### m-11: Plan specified components not implemented
Multiple components from the plan are listed as placeholders or not implemented:
- `PracticeCard.tsx` (Step 9) — not created
- `PracticeExercise.tsx` (Step 9) — not created
- `RadioInput.tsx`, `CheckboxInput.tsx`, `FreeResponseInput.tsx` (Step 12) — not created
- `PersonaSwitcher.tsx`, `CorrectAnswerCelebration.tsx` (Step 13) — not created
- `MobileBottomSheet.tsx` (Step 11) — not created (only a `MobileNavTrigger` placeholder exists)

These are significant spec requirements (FR-011, FR-012, FR-019, FR-016, FR-022, FR-030, FR-032) that are unimplemented.

---

## Positive Observations

1. **Design token architecture** is well-structured — glassmorphism tokens, extended radii, and mode colors are properly integrated into both `tailwind.tokens.mjs` and `tailwind.config.mjs`.
2. **CSS custom property approach** for mode theming is correct and scalable.
3. **Glassmorphism fallback** via `@supports` is properly implemented.
4. **i18n structure** (English) is comprehensive and properly namespaced.
5. **Import paths** all reference existing project modules (`@/infra/utils/ui`, `@/ui/web/providers/I18n`, etc.) correctly.
6. **Server component data fetching** pattern in `page.tsx` follows existing project conventions.
7. **Reduced motion** CSS global rule is a good baseline.
8. **Touch target sizing** consistently enforced with `min-h-[48px] min-w-[48px]`.

---

## Issue Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| Critical | 4 | SSR crash, broken animations, CSS scoping, i18n mismatch |
| Major | 10 | Dead code, wrong labels, scroll bugs, hardcoded strings |
| Minor | 11 | Stale state, ARIA semantics, missing components |

**Recommendation:** Fix all Critical and Major issues before merging. The Critical issues (C-01, C-02, C-03, C-04) will cause runtime failures in production. The missing components (m-11) represent significant spec gaps that should be tracked as follow-up work items.
