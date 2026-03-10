# Implementation Plan: Course Studying Page UI Redesign

## Overview

Redesign the Course Studying page as a **new variant** route that matches the Figma prototype's visual language — soft geometry, glassmorphism, and mode-based chromatic theming (Study/Practice/Hint-Ask/Test). The existing studying page and functional logic are preserved; the new variant lives alongside them. The plan delivers: a ModeContext provider with CSS custom property injection, extended design tokens (radii, glassmorphism, mode palettes), a split-pane workspace with contextual sidebar, mode-specific UI behaviors (practice cards, chat slide-in, test timer), mobile bottom sheet, full i18n/RTL support, and reduced-motion accessibility.

**Clarified decisions** (from clarified.md):
1. **New variant** — ship alongside existing pages (not replace)
2. **Animation library** — only if must; follow Figma design (framer-motion for 3D/flip)
3. **Reuse** existing patterns during implementation
4. **Theme** — match the Figma prototype

---

## Steps

### Step 1: Install framer-motion and extend design tokens

**Files:**
- `package.json` (MODIFIED) — add `framer-motion` dependency
- `tailwind.tokens.mjs` (MODIFIED) — add glassmorphism + extended radii tokens
- `tailwind.config.mjs` (MODIFIED) — wire new tokens into theme
- `src/app/(frontend)/globals.css` (MODIFIED) — add mode CSS custom properties and glass utilities

**Behavior:**
1. Install `framer-motion` (`pnpm add framer-motion`)
2. Add to `tailwind.tokens.mjs`:
   - `borderRadius`: `'3xl': '20px'`, `'4xl': '24px'`, `'5xl': '32px'`
   - `backdropBlur`: `'glass-sm': '8px'`, `'glass-md': '12px'`, `'glass-lg': '16px'`
   - `boxShadow`: `'glass': '0 4px 30px rgba(0,0,0,0.1)'`, `'3d-lift': '0 10px 30px rgba(0,0,0,0.15)'`, `'3d-lift-hover': '0 20px 40px rgba(0,0,0,0.2)'`
3. Add to `tailwind.config.mjs` `extend.borderRadius`: `'3xl'`, `'4xl'`, `'5xl'` tokens
4. Add mode CSS custom properties in `globals.css`:
   ```css
   [data-study-mode="study"] { --mode-bg: 245 100% 98%; --mode-accent: 231 76% 60%; --mode-accent-fg: 0 0% 100%; --mode-surface: 240 100% 99%; --mode-border: 231 76% 90%; }
   [data-study-mode="hint"] { --mode-bg: 271 100% 98%; --mode-accent: 271 91% 65%; ... }
   [data-study-mode="practice"] { --mode-bg: 152 100% 97%; --mode-accent: 152 69% 45%; ... }
   [data-study-mode="test"] { --mode-bg: 25 100% 97%; --mode-accent: 25 95% 55%; ... }
   ```
5. Add glassmorphism utility classes:
   ```css
   .glass-surface { background: hsl(var(--mode-surface) / 0.7); backdrop-filter: blur(12px); border: 1px solid hsl(var(--mode-border) / 0.2); }
   @supports not (backdrop-filter: blur(1px)) { .glass-surface { background: hsl(var(--mode-surface) / 0.95); } }
   ```
6. Add `--mode-*` color references in `tailwind.config.mjs` `colors`:
   ```js
   mode: { bg: 'hsl(var(--mode-bg))', accent: 'hsl(var(--mode-accent))', 'accent-fg': 'hsl(var(--mode-accent-fg))', surface: 'hsl(var(--mode-surface))', border: 'hsl(var(--mode-border))' }
   ```

**Tests:**
- `pnpm tsc --noEmit` passes
- `pnpm build` does not regress
- Verify framer-motion is importable in a test component

**Acceptance Criteria:**
- framer-motion is available for import
- New Tailwind classes (`rounded-4xl`, `bg-mode-accent`, `shadow-3d-lift`, `glass-surface`) resolve correctly
- Mode CSS variables respond to `data-study-mode` attribute
- Glassmorphism fallback applies without `backdrop-filter` support

**Estimated time:** 20 min

---

### Step 2: Create ModeContext provider and mode toggle component

**Files:**
- `src/ui/web/providers/StudyMode/index.tsx` (NEW) — ModeContext provider
- `src/ui/web/providers/StudyMode/types.ts` (NEW) — mode types
- `src/ui/web/components/study-mode-toggle/index.tsx` (NEW) — mode toggle UI

**Behavior:**
1. Define `StudyMode` type: `'study' | 'hint' | 'practice' | 'test'`
2. Create `StudyModeProvider` that:
   - Stores current mode in state (default: `'study'`)
   - Syncs mode to URL search param `?mode=` via `useSearchParams` + `router.replace`
   - Sets `data-study-mode` attribute on a wrapping `<div>` (not html, to scope to studying page)
   - Preserves context across mode switches: lesson/exercise selection, exercise answers, chat state
   - Exposes `{ mode, setMode, previousMode }` via context
3. Create `StudyModeToggle` component:
   - Renders 4 pill-shaped buttons (Study / Hint / Practice / Test)
   - Active button has `bg-mode-accent text-mode-accent-fg` with smooth transition
   - Inactive buttons have `bg-mode-surface/50 text-muted-foreground hover:bg-mode-surface`
   - Uses `rounded-full` pill shape, minimum 48px height for touch targets
   - i18n labels via `useTranslations('studyMode')`
   - `prefers-reduced-motion`: instant color change, no spring animation
   - Keyboard accessible: arrow keys cycle through modes, Enter/Space activates

**Tests:**
- ModeContext updates correctly on setMode call
- URL search param syncs with mode state
- `data-study-mode` attribute updates on wrapping element
- Mode changes don't remount children (verify with ref stability test)

**Acceptance Criteria:**
- FR-007: Four modes toggle without full page reload
- FR-009: Mode toggle preserves studying context
- NFR-002: No full reload on toggle
- FR-026: CSS custom properties injected per mode

**Estimated time:** 25 min

---

### Step 3: Add i18n translation keys for all new UI elements

**Files:**
- `src/i18n/en.json` (MODIFIED) — add `studyMode` namespace
- `src/i18n/he.json` (MODIFIED) — add Hebrew translations

**Behavior:**
Add new namespace `studyMode` with keys:
```json
{
  "studyMode": {
    "study": "Study",
    "hint": "Hint",
    "practice": "Practice",
    "test": "Test",
    "toggleLabel": "Study Mode",
    "timer": {
      "label": "Test Timer",
      "pause": "Pause",
      "resume": "Resume",
      "remaining": "Time Remaining"
    },
    "sidebar": {
      "label": "Lesson Navigation",
      "progress": "Progress",
      "exercises": "Exercises",
      "collapse": "Collapse sidebar",
      "expand": "Expand sidebar"
    },
    "bottomSheet": {
      "label": "Navigation",
      "dragHandle": "Drag to resize"
    },
    "practiceCard": {
      "flip": "Flip card",
      "front": "Question",
      "back": "Answer"
    },
    "chat": {
      "panelLabel": "AI Tutor Chat",
      "hintPolicy": "Hint Mode",
      "askPolicy": "Ask Mode",
      "policyIndicator": "Response policy: {policy}",
      "slideIn": "Open chat",
      "slideOut": "Close chat"
    },
    "testMode": {
      "restrictedNav": "Navigation is restricted during test mode",
      "confirmLeave": "Are you sure you want to leave the test?",
      "timerExpired": "Time is up!"
    }
  }
}
```
Add corresponding Hebrew translations in `he.json`.

**Tests:**
- `useTranslations('studyMode')` returns correct strings for both locales
- No missing keys (spot-check all keys used in subsequent steps)

**Acceptance Criteria:**
- FR-024: All user-facing strings are translatable
- NFR-008: Translation key plan complete before implementation

**Estimated time:** 15 min

---

### Step 4: Build the contextual navigation sidebar with progress indicators

**Files:**
- `src/ui/web/components/studying-sidebar/index.tsx` (NEW) — main sidebar component
- `src/ui/web/components/studying-sidebar/SidebarItem.tsx` (NEW) — individual nav item
- `src/ui/web/components/studying-sidebar/CircularProgress.tsx` (NEW) — circular progress indicator

**Behavior:**
1. `StudyingSidebar` component:
   - Fixed-width sidebar (280px desktop, collapsible)
   - Background: `glass-surface` with `rounded-4xl` on the content-facing edge
   - Lists chapters → lessons → exercises in collapsible tree
   - Active item highlighted with `bg-mode-accent/10 border-s-2 border-mode-accent`
   - Uses `data-study-mode` for accent color via CSS variables
2. `SidebarItem` component:
   - Pill-shaped item (`rounded-full px-4 py-3`)
   - Shows exercise title, circular progress indicator, completion status
   - Min height 48px (FR-023)
   - Click navigates to exercise without full page reload
3. `CircularProgress` component:
   - SVG-based circular progress (24px diameter)
   - Stroke color: `var(--mode-accent)`
   - Completed: filled circle with checkmark
   - In-progress: partial arc
   - Accessible: `role="progressbar" aria-valuenow={percent}`

**Tests:**
- Sidebar renders all exercises for current lesson
- Active item updates on exercise selection
- Progress indicators reflect completion state
- Keyboard navigation through sidebar items works

**Acceptance Criteria:**
- FR-003: Split-pane layout sidebar portion
- FR-004: Contextual navigation with floating pill controls and circular progress
- FR-002: High-radius corners on sidebar container (≥24px)
- FR-023: 48px minimum touch targets

**Estimated time:** 30 min

---

### Step 5: Build the content canvas and master workspace layout

**Files:**
- `src/ui/web/components/studying-workspace/index.tsx` (NEW) — master workspace
- `src/ui/web/components/studying-workspace/ContentCanvas.tsx` (NEW) — centered content area
- `src/ui/web/components/studying-workspace/WorkspaceHeader.tsx` (NEW) — workspace header with mode toggle

**Behavior:**
1. `StudyingWorkspace` component:
   - Top-level layout: `fixed inset-0 z-50 flex` (same pattern as existing `ExerciseWorkspace`)
   - Wraps children in `StudyModeProvider`
   - Layout: `[Sidebar] [ContentCanvas]` on desktop
   - Applies `data-study-mode` for chromatic theming
   - Background transitions smoothly between mode colors
2. `ContentCanvas` component:
   - Centered content area with `max-w-4xl mx-auto` (FR-005)
   - Padding: `p-6 md:p-8`
   - Background: `bg-mode-bg` with subtle gradient overlay
   - Overflow: `overflow-y-auto` with scroll position per mode (store in ref map)
3. `WorkspaceHeader` component:
   - Fixed top bar with: back button, lesson title, `StudyModeToggle`, user avatar
   - Background: `glass-surface` 
   - `rounded-b-4xl` bottom corners
   - RTL-aware layout using `flex-row` (auto-flips with dir="rtl")

**Tests:**
- Workspace renders with sidebar + content canvas side by side on desktop
- Content canvas constrains width to max-w-4xl
- Mode toggle in header switches modes and updates theme
- Scroll position preserved independently per mode

**Acceptance Criteria:**
- FR-003: Master workspace split-pane layout
- FR-005: Content canvas readability constraints (max-w-4xl)
- FR-008: Mode-based chromatic theming applied
- FR-009: Scroll position preserved across mode toggles

**Estimated time:** 25 min

---

### Step 6: Integrate exercise rendering into new workspace with mode-aware behavior

**Files:**
- `src/ui/web/components/studying-workspace/ExerciseView.tsx` (NEW) — mode-aware exercise wrapper
- `src/ui/web/components/studying-workspace/StudyModeExercise.tsx` (NEW) — study mode view
- `src/ui/web/components/studying-workspace/PracticeExercise.tsx` (NEW) — placeholder for practice cards (Step 9)

**Behavior:**
1. `ExerciseView` component:
   - Dispatches to mode-specific views based on current `StudyMode`
   - `study` mode: renders `ExerciseRenderer` inside `ContentCanvas` with existing validation
   - `hint`/`ask` mode: same as study + chat panel slides in (Step 8)
   - `practice` mode: renders `PracticeExercise` cards (Step 9)
   - `test` mode: renders `ExerciseRenderer` with restricted UI (Step 10)
2. `StudyModeExercise` component:
   - Wraps `ExerciseRenderer` in card with `rounded-4xl border border-mode-border shadow-card`
   - Progress bar at top matches mode accent color
   - Exercise title + ordinal with mode-colored icon
   - Navigation footer (prev/next) with pill-shaped buttons
   - Preserves all existing `ExerciseRenderer` props (content, mode, showCheckAnswer, mediaMap)
3. State preservation:
   - Exercise answers stored in context/ref, not reset on mode switch
   - Current exercise index preserved across modes
   - Validation feedback preserved unless explicitly reset

**Tests:**
- `ExerciseRenderer` renders correctly inside new workspace
- Answer state persists across mode switches
- Exercise navigation (prev/next) works
- Math/LaTeX renders legibly on mode-tinted backgrounds (FR-006)

**Acceptance Criteria:**
- NFR-001: Existing functional logic preserved
- FR-006: High-fidelity math/LaTeX rendering on all mode tints
- FR-009: Exercise answers and validation preserved across mode toggles
- FR-019: Exercise inputs with complete state set

**Estimated time:** 30 min

---

### Step 7: Create the new variant route and wire everything together

**Files:**
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/study/page.tsx` (NEW) — new variant route
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/study/layout.tsx` (NEW) — layout with providers

**Behavior:**
1. New route at `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/study`
   - Server component that fetches course, lesson, exercises (same as existing `page.tsx`)
   - Passes data to `StudyingWorkspace` client component
   - Wraps in `AccessGateProvider` (same pattern as existing)
2. Layout wraps children in `StudyModeProvider`
3. The route renders `StudyingWorkspace` with:
   - `StudyingSidebar` (from Step 4) with exercise list
   - `ContentCanvas` (from Step 5) with `ExerciseView` (from Step 6)
   - `WorkspaceHeader` with mode toggle
4. URL supports `?mode=study|hint|practice|test` query param

**Tests:**
- Route `/courses/.../lessons/.../study` renders new workspace
- Existing `/courses/.../lessons/.../` route remains unchanged
- Mode query param syncs with UI state
- Full exercise flow works: intro → exercises → outro

**Acceptance Criteria:**
- Clarified #1: New variant (not replacement)
- FR-001: Visual fidelity to Figma
- NFR-001: Existing routes preserved

**Estimated time:** 20 min

---

### Step 8: Implement Hint/Ask mode slide-in chat panel

**Files:**
- `src/ui/web/components/studying-workspace/ChatSlidePanel.tsx` (NEW) — animated chat container
- `src/ui/web/components/studying-workspace/ChatPolicyIndicator.tsx` (NEW) — hint vs ask indicator
- `src/ui/web/components/studying-workspace/ExerciseView.tsx` (MODIFIED) — add chat panel for hint mode

**Behavior:**
1. `ChatSlidePanel` component:
   - Wraps existing `ChatInterface` in animated container
   - Uses `framer-motion` `AnimatePresence` + `motion.div` for slide-in
   - Slides from logical end (RTL: `left: 0`, LTR: `right: 0`) — check `dir` attribute
   - Width: 400px on desktop, full-width on mobile
   - Background: `glass-surface` with `rounded-s-4xl` (start-side corners)
   - `prefers-reduced-motion`: instant visibility, no slide animation (NFR-004)
   - Close button (X) with 48px hit area
   - Focus trap when open (NFR-003)
2. `ChatPolicyIndicator` component:
   - Small badge showing "Hint" or "Ask" mode
   - "Hint" = scaffolding responses (no direct answers)
   - "Ask" = direct answer responses
   - Toggle between hint/ask within the chat panel header
   - Uses mode-accent gradient for badge background
3. Chat session identity:
   - `conversationId` scoped per lesson (stable across hint↔ask toggles)
   - Messages persist across: panel open/close, mode toggles, persona switches
   - Policy (hint vs ask) sent as parameter to AI, not resetting conversation
4. Streaming & error handling:
   - Single in-flight request at a time
   - Cancel button stops streaming, marks message as cancelled with partial text visible
   - Network errors show error bubble with retry button
   - Rate limit / auth expiry: specific error messages with action buttons
   - Retry generates new request (idempotent, no duplicate sends)

**Tests:**
- Chat panel slides in when mode is `hint`
- RTL: panel slides from left; LTR: panel slides from right
- Messages persist across hint↔ask toggle
- Cancel streaming works and shows partial message
- Retry after error sends new request

**Acceptance Criteria:**
- FR-013: Slide-in glassmorphic chat panel from logical end side
- FR-014: Chat session identity persists across toggles
- FR-015: Hint vs Ask behavioral policy in UI
- FR-017: Streaming, errors, and recovery
- FR-029: Slide-in animation wrapper
- FR-010: Glassmorphism with fallback

**Estimated time:** 30 min

---

### Step 9: Implement Practice mode interactive exercise cards

**Files:**
- `src/ui/web/components/studying-workspace/PracticeCard.tsx` (NEW) — 3D flip card
- `src/ui/web/components/studying-workspace/PracticeExercise.tsx` (MODIFIED) — practice mode view

**Behavior:**
1. `PracticeCard` component:
   - 3D card with front (question) and back (answer/explanation)
   - Uses `framer-motion` for:
     - **3D lift hover**: `translateY(-4px)` + `shadow-3d-lift-hover` on hover
     - **Flip transition**: `rotateY(180deg)` with `backface-visibility: hidden`
   - Front side: exercise question content, rendered via `ExerciseRenderer` blocks
   - Back side: correct answer, explanation, feedback
   - Flip trigger: click/tap + keyboard (Enter/Space)
   - Card container: `rounded-4xl bg-mode-surface border border-mode-border shadow-card`
   - `prefers-reduced-motion`: no 3D lift, no flip (instant show/hide), card still functional
   - Min size: 48px touch targets on flip control
2. `PracticeExercise` view:
   - Replaces static content with card grid when in practice mode
   - Cards fade in bottom-to-top with stagger (FR-021)
   - Single card or grid layout based on exercise count
   - Correct answer: green pulse on card edges (FR-021)
3. Card interaction rules (FR-012):
   - Click/tap to flip
   - Enter/Space keyboard equivalent
   - Front: question prompt + input fields (if applicable)
   - Back: correct answer + explanation + optional "next" button

**Tests:**
- Card renders front side by default
- Click flips to back side
- Enter/Space trigger flip
- 3D lift effect visible on hover (desktop)
- Reduced motion: no animation, instant flip
- Correct answer shows green pulse

**Acceptance Criteria:**
- FR-011: Practice mode interactive cards with 3D lift + flip
- FR-012: Card interaction rules (click/tap/keyboard)
- FR-021: Enter practice transition (bottom-to-top fade/move)
- FR-032: 3D lift and flip with keyboard and reduced motion
- NFR-004: Reduced motion disables 3D effects

**Estimated time:** 30 min

---

### Step 10: Implement Test mode restrictions and floating timer

**Files:**
- `src/ui/web/components/studying-workspace/TestModeTimer.tsx` (NEW) — floating timer
- `src/ui/web/components/studying-workspace/TestModeGuard.tsx` (NEW) — navigation restriction
- `src/ui/web/components/studying-workspace/ExerciseView.tsx` (MODIFIED) — test mode behavior

**Behavior:**
1. `TestModeTimer` component:
   - Floating timer positioned `fixed top-4 end-4` (RTL-aware: `end` = logical end)
   - `glass-surface rounded-full px-4 py-2` with mode-accent border
   - Safe-area inset awareness: `pt-[env(safe-area-inset-top)]`
   - Displays MM:SS countdown format
   - Pause/resume toggle button (48px hit area)
   - Configurable duration (default: 60 min, stored in state)
   - Timer state: `sessionStorage` (persists across same-tab refresh, not across tabs)
   - `aria-live="polite"` for screen reader updates at 5-min intervals
   - Expiry: shows alert dialog with i18n string
2. `TestModeGuard` component:
   - When `mode === 'test'`:
     - Sidebar navigation items are visible but show confirmation dialog before switching
     - Mode toggle disabled except to exit test mode (requires confirmation)
     - Back button shows "Are you sure?" dialog
   - Uses `beforeunload` event to warn on tab/window close
   - Confirmation dialog: `@radix-ui/react-dialog` with i18n strings
3. Test mode UI changes:
   - Header/border accents shift to test palette (orange/warm red)
   - Chat is **disabled** in test mode (no hint/ask allowed)
   - Navigation restriction: confirmation dialog on any navigation attempt

**Tests:**
- Timer counts down correctly
- Timer pauses and resumes
- Timer persists in sessionStorage across same-tab refresh
- Navigation shows confirmation dialog in test mode
- Mode toggle disabled during test (except exit with confirm)
- Timer respects safe-area insets

**Acceptance Criteria:**
- FR-018: Test mode UX (orange accents, restricted nav, floating timer)
- FR-031: Test mode timer with safe-area, pause/resume, configurable duration
- FR-023: 48px touch targets on timer controls

**Estimated time:** 25 min

---

### Step 11: Implement mobile bottom sheet navigation

**Files:**
- `src/ui/web/components/studying-workspace/MobileBottomSheet.tsx` (NEW) — bottom sheet component
- `src/ui/web/components/studying-workspace/index.tsx` (MODIFIED) — responsive layout switch

**Behavior:**
1. `MobileBottomSheet` component:
   - Replaces sidebar on screens < 1024px (FR-022)
   - Uses `framer-motion` `useDragControls` for drag-to-resize
   - Three snap points: collapsed (80px), half (50vh), full (90vh)
   - Drag affordance: centered pill handle (40px × 4px, `rounded-full bg-muted-foreground/30`)
   - Background: `glass-surface rounded-t-4xl`
   - Backdrop: `bg-black/30` with tap-to-dismiss
   - Scroll locking: `document.body.style.overflow = 'hidden'` when open
   - Safe-area insets: `pb-[env(safe-area-inset-bottom)]`
   - Content: same `StudyingSidebar` items
   - Focus trap when fully expanded
   - `prefers-reduced-motion`: instant snap to positions, no spring animation
2. `StudyingWorkspace` responsive behavior:
   - Desktop (≥1024px): sidebar + content canvas side by side
   - Mobile (<1024px): content canvas full-width, bottom sheet for navigation
   - Breakpoint detection via `useMediaQuery('(min-width: 1024px)')`

**Tests:**
- Bottom sheet renders on mobile viewport
- Drag handle moves between snap points
- Backdrop tap dismisses to collapsed
- Scroll locking active when expanded
- Keyboard accessible (Escape to dismiss)
- Reduced motion: instant transitions

**Acceptance Criteria:**
- FR-022: Mobile bottom sheet with snap points, drag, backdrop, scroll lock, safe-area
- FR-030: Bottom sheet specification
- FR-002: High-radius corners on bottom sheet (rounded-t-4xl)
- NFR-004: Reduced motion support

**Estimated time:** 30 min

---

### Step 12: Implement interactive input patterns and transition animations

**Files:**
- `src/ui/web/components/studying-inputs/RadioInput.tsx` (NEW) — large circular radio
- `src/ui/web/components/studying-inputs/CheckboxInput.tsx` (NEW) — pill-shaped checkbox
- `src/ui/web/components/studying-inputs/FreeResponseInput.tsx` (NEW) — translucent auto-expanding textarea
- `src/ui/web/components/studying-workspace/transitions.tsx` (NEW) — reusable transition variants

**Behavior:**
1. `RadioInput`:
   - Large circular radio (32px outer, 16px inner fill) with smooth fill animation
   - States: default/hover/focus/selected/disabled/error with distinct visuals
   - Selected: `bg-mode-accent` fill with scale animation
   - 48px hit area wrapper
2. `CheckboxInput`:
   - Pill-shaped (`rounded-full px-4 py-2`) with smooth fill
   - Checkmark SVG animates in on selection
   - Same state set as RadioInput
3. `FreeResponseInput`:
   - Auto-expanding `<textarea>` with translucent background (`bg-mode-surface/50`)
   - `rounded-3xl` border, focus ring in mode accent color
   - Adjusts height dynamically via `scrollHeight`
4. `transitions.tsx` — framer-motion variant objects:
   - `fadeInUp`: enter practice cards from bottom
   - `slideInEnd`: chat panel slide-in (RTL-aware)
   - `correctPulse`: green pulse on card borders
   - `crossFade`: persona avatar transition
   - All variants check `prefers-reduced-motion` and use instant transitions if set

**Tests:**
- Radio input selects with animation, reflects correct state
- Checkbox pill toggles with checkmark animation
- Textarea auto-expands on content
- All inputs meet 48px hit area
- Reduced motion: animations disabled, functionality preserved

**Acceptance Criteria:**
- FR-019: Tactile input patterns matching Figma (radios, checkboxes, textareas)
- FR-021: Defined transitions for key interactions
- NFR-004: Reduced motion respected
- FR-023: 48px minimum touch targets

**Estimated time:** 25 min

---

### Step 13: Persona switching and correct-answer celebrations

**Files:**
- `src/ui/web/components/studying-workspace/PersonaSwitcher.tsx` (NEW) — persona selection
- `src/ui/web/components/studying-workspace/CorrectAnswerCelebration.tsx` (NEW) — celebration effect

**Behavior:**
1. `PersonaSwitcher` (FR-016 SHOULD):
   - Dropdown in chat panel header showing available personas/teachers
   - Switching cross-fades avatar with `framer-motion` `AnimatePresence`
   - Updates chat accent color subtly
   - Persona change affects future AI responses (sent as context param)
   - Does NOT rewrite prior messages
   - `prefers-reduced-motion`: instant swap, no crossfade
2. `CorrectAnswerCelebration`:
   - On correct answer: soft green pulse on exercise card border
   - `framer-motion` `animate` with `boxShadow` keyframes
   - Milestone celebrations (e.g., all exercises complete): subtle confetti or checkmark animation
   - `prefers-reduced-motion`: static green border only, no animation/confetti

**Tests:**
- Persona switch updates avatar with crossfade
- Prior messages unchanged after persona switch
- Correct answer triggers green pulse
- Reduced motion: static effects only

**Acceptance Criteria:**
- FR-016: Persona switching with cross-fade
- FR-021: Correct answer green pulse
- NFR-004: Reduced motion support

**Estimated time:** 20 min

---

### Step 14: RTL correctness, accessibility audit, and keyboard navigation

**Files:**
- Multiple files from Steps 4-13 (MODIFIED) — RTL and a11y fixes

**Behavior:**
1. RTL audit across all new components:
   - Verify `start/end` (not `left/right`) for all directional properties
   - Chat slide-in direction determined by `dir` attribute (logical end)
   - Chevron icons rotate correctly in RTL
   - Bottom sheet drag direction unchanged (vertical)
   - Math content remains LTR within RTL containers (`dir="ltr"` on KaTeX blocks)
2. Keyboard navigation audit:
   - Mode toggle: arrow keys cycle, Enter/Space activate
   - Sidebar: arrow keys navigate items, Enter selects
   - Practice cards: Enter/Space flip
   - Chat panel: Escape closes, focus trapped inside
   - Bottom sheet: Escape dismisses, Tab cycles through interactive elements
   - Timer: buttons are focusable and operable via keyboard
3. Focus management:
   - Focus trap in chat panel (when open as overlay)
   - Focus trap in bottom sheet (when expanded)
   - Focus returns to trigger element when panel/sheet closes
   - Visible focus ring on all interactive elements (`focus-visible:ring-2 ring-mode-accent`)
4. ARIA attributes:
   - `role="tablist"` on mode toggle, `role="tab"` on each mode button
   - `role="navigation"` on sidebar
   - `role="dialog"` on chat panel and bottom sheet
   - `aria-expanded` on collapsible sections
   - `aria-current="step"` on active exercise
5. Color contrast:
   - Verify WCAG 2.1 AA (4.5:1 text, 3:1 UI) against all four mode backgrounds
   - Glassmorphism surfaces: verify contrast with increased opacity fallback

**Tests:**
- Full keyboard operation of all components without mouse
- Screen reader announces mode changes, progress, dialogs
- RTL layout mirrors correctly (spot check 5+ components)
- Color contrast ratios meet AA on all mode tints

**Acceptance Criteria:**
- FR-024: i18n + RTL correctness
- NFR-003: WCAG 2.1 AA accessibility baseline
- NFR-004: Reduced motion support
- FR-023: 48px touch targets

**Estimated time:** 30 min

---

### Step 15: Generate import maps, run quality gates, and final validation

**Files:**
- No new files — validation and generation pass

**Behavior:**
1. Run `pnpm generate:importmap` to update admin import map
2. Run `pnpm tsc --noEmit` — fix any TypeScript errors
3. Run `pnpm lint` — fix any linting issues
4. Run `pnpm format:fix` — ensure consistent formatting
5. Manual visual verification against Figma:
   - Study mode: lavender/soft blue backgrounds
   - Hint mode: purple/indigo accents
   - Practice mode: emerald green accents with card interactions
   - Test mode: orange/warm red accents with timer
6. Verify all acceptance criteria from spec.md checklist
7. Build verification: `pnpm build` succeeds without errors

**Tests:**
- TypeScript compilation passes
- Lint passes
- Build succeeds
- No regressions to existing routes

**Acceptance Criteria:**
- All spec acceptance criteria verified
- No TypeScript errors
- No lint errors
- Build passes
- Existing studying page routes unchanged

**Estimated time:** 15 min

---

## Assumptions

1. **Figma prototype** at the provided URL shows the exact visual language, but since it requires JavaScript and cannot be fetched directly, implementation will use the detailed spec requirements (FR-001 through FR-032) as the source of truth for visual design.
2. **framer-motion** is the selected animation library (spec FR-025 recommends it; clarified.md says "only if must" — the 3D lift, flip, and slide-in requirements necessitate it over CSS-only).
3. **Chat conversation scope** is per-lesson (matching existing `chatLessonId = lesson.id` pattern in the codebase).
4. **Test mode timer** persists in sessionStorage (survives same-tab refresh, not cross-tab).
5. **Chat is disabled in test mode** (most conservative interpretation of restricted navigation).
6. **Scroll position** is preserved independently per mode using ref-based storage.
7. **New variant route** at `.../study` sits alongside existing `.../lessons/[lessonSlug]` route — no redirect or replacement.
8. **Existing ExerciseRenderer**, answer checking, help system, and ChatInterface are reused as-is — only wrapped in new layout/styling.
9. **Mode colors** will be tuned after initial implementation to match Figma precisely; the CSS variable approach makes this a configuration change.
10. **Persona switching** (FR-016 SHOULD priority) is implemented with basic cross-fade; full persona system depends on existing AI infrastructure.

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| framer-motion bundle size increases page load | Medium | High | Use dynamic imports (`next/dynamic`) for practice cards and chat panel; tree-shake unused features |
| Glassmorphism contrast fails WCAG on tinted surfaces | High | Medium | Design fallback with higher surface opacity (0.9+); test with axe-core on all 4 modes |
| Mode CSS variables conflict with existing dark/light theme | Medium | Low | Scope mode variables to `data-study-mode` attribute on workspace div, not `<html>` |
| Chat state loss during mode transitions | High | Medium | Store chat state in ref outside of mode-switching components; verify with integration test |
| Bottom sheet gesture conflicts with page scroll on mobile | Medium | Medium | Use `touch-action: none` on drag handle; test on iOS Safari and Chrome Android |
| Existing ExerciseRenderer styling clashes with mode-tinted backgrounds | Medium | Medium | Wrap renderer in neutral-background container if needed; test each question type |
| RTL slide-in direction incorrect | Low | Low | Use `useLocale()` to determine direction; test with `dir="rtl"` on container |
| Timer sessionStorage persistence unreliable | Low | Low | Add localStorage fallback; validate timer state on component mount |
| Performance of 3D transforms on low-end mobile devices | Medium | Medium | Use `will-change: transform` judiciously; test on throttled CPU; disable 3D on `prefers-reduced-motion` |
| Translation key mismatches between en/he | Low | High | Add i18n key validation in CI; manually cross-check all new keys |
