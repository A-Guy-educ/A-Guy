# Plan: Add ChatInterface to ExercisesPager

**Date:** 2026-02-10
**Status:** Approved (awaiting implementation)
**Parent:** feat/lesson-step-pager-routing

## Goal

Add ChatInterface to the ExercisesPager with the same behavior as ExerciseWorkspace (split-pane on desktop, PDF/Chat toggle on mobile) WITHOUT using the fullscreen overlay pattern.

## Background

The ExercisesPager currently renders exercise cards in a centered `max-w-3xl` layout without chat. The ExerciseWorkspace has the desired chat behavior (ResizablePane horizontal split on desktop, 3-state toggle on mobile) but is hardcoded as a fullscreen `fixed inset-0 z-50` overlay.

## Solution Overview

Extract the split-pane + mobile toggle logic from ExerciseWorkspace into a reusable `SplitPaneLayout` component, then use it in both:

1. **ExerciseWorkspace** (wraps with fullscreen overlay) — unchanged behavior
2. **ExercisesPager** (inline within page) — new chat integration

---

## Step 1: Create SplitPaneLayout Component

**New file:** `src/ui/web/components/split-pane-layout.tsx`

### Extracted from ExerciseWorkspace:

| Responsibility      | Details                                                    |
| ------------------- | ---------------------------------------------------------- |
| **Desktop layout**  | `ResizablePane` horizontal split, default 70/30, draggable |
| **Mobile layout**   | 3-state toggle (PDF collapsed, PDF expanded, Chat mode)    |
| **Props injection** | `cloneElement` to inject mobile props into chat            |
| **Breakpoint**      | `useMediaQuery('(min-width: 1024px)')`                     |
| **Resize state**    | localStorage persistence with configurable `storageKey`    |
| **Drag handlers**   | Mouse/touch handlers for resize                            |

### Props Interface

```typescript
interface SplitPaneLayoutProps {
  /** Content for the left/primary pane (e.g., exercise content) */
  primaryContent: React.ReactNode
  /** Content for the right/secondary pane (e.g., ChatInterface) */
  chatContent: React.ReactNode
  /** Optional container className */
  className?: string
  /** localStorage key for split size persistence */
  storageKey?: string
  /** Default split percentage (default: 70) */
  defaultSize?: number
  /** Minimum split percentage (default: 20) */
  minSize?: number
  /** Maximum split percentage (default: 80) */
  maxSize?: number
}
```

### What is NOT included (stays in ExerciseWorkspace):

- `fixed inset-0 z-50` positioning
- `ExerciseHeader`
- Auth/user logic (`useCurrentUser`)
- `exerciseTitle` prop

---

## Step 2: Refactor ExerciseWorkspace

**File:** `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx`

### Before (~254 lines)

Full implementation of split-pane + mobile toggle + fullscreen overlay + header + auth.

### After (~40 lines)

```tsx
'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { usePathname } from 'next/navigation'
import { ExerciseHeader } from '../ExerciseHeader'
import { SplitPaneLayout } from '@/ui/web/components/split-pane-layout'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl?: string
  pdfContent: React.ReactNode
  chatContent: React.ReactNode
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  pdfContent,
  chatContent,
}: ExerciseWorkspaceProps) {
  const { user, isLoading: isAuthLoading } = useCurrentUser()
  const pathname = usePathname()

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <ExerciseHeader
        exerciseTitle={exerciseTitle}
        backUrl={backUrl}
        onMenuClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
        user={user}
        isAuthLoading={isAuthLoading}
        currentUrl={pathname}
      />
      <SplitPaneLayout
        primaryContent={pdfContent}
        chatContent={chatContent}
        storageKey="exercise-split-size"
        className="flex-1"
      />
    </div>
  )
}
```

### Backwards Compatibility

- Same props interface
- Same behavior
- Same file location
- No breaking changes to callers

---

## Step 3: Add lessonId Prop to ExercisesPager

### Files to Modify

| File                                | Line   | Change                                    |
| ----------------------------------- | ------ | ----------------------------------------- |
| `ExercisesPager/index.tsx`          | 13-20  | Add `lessonId: string` to props interface |
| `lessons/[lessonSlug]/page.tsx`     | 68-75  | Pass `lessonId={lesson.id}`               |
| `exercises/[exerciseSlug]/page.tsx` | 95-102 | Pass `lessonId={lesson.id}`               |

### ExercisesPager Props After

```typescript
interface ExercisesPagerProps {
  exercises: Exercise[]
  lessonTitle: string
  backUrl: string
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  lessonId: string // NEW: for ChatInterface scoping
}
```

---

## Step 4: Integrate SplitPaneLayout + ChatInterface into ExercisesPager

**File:** `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`

### Import Changes

```typescript
import { SplitPaneLayout } from '@/ui/web/components/split-pane-layout'
import { ChatInterface } from '@/ui/web/chat'
```

### Layout Strategy

| Step Type  | Layout                                                              |
| ---------- | ------------------------------------------------------------------- |
| `intro`    | Current centered card layout (`max-w-3xl`, no chat)                 |
| `exercise` | `SplitPaneLayout` fills available space (exercise left, chat right) |
| `outro`    | Current centered card layout (`max-w-3xl`, no chat)                 |

### Exercise Step Implementation

When `pageState.type === 'exercise'`:

```tsx
<SplitPaneLayout
  primaryContent={
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Exercise Header Card */}
      <div className="bg-card rounded-3xl p-6 md:p-8 ...">
        {/* ... existing header card content ... */}
      </div>

      {/* Exercise Content Card */}
      <div className="bg-card rounded-3xl p-6 md:p-8 ...">
        <ExerciseRenderer
          content={...}
          mode="student"
          showCheckAnswer={true}
        />
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between ...">
        {/* ... existing nav buttons ... */}
      </div>
    </div>
  }
  chatContent={
    <ChatInterface
      key={currentExercise.id}  // Force remount on exercise change
      lessonId={lessonId}
      exerciseId={currentExercise.id}
      translationNamespace="courses"
      showMathTools={true}
    />
  }
  className="flex-1"
  storageKey="pager-split-size"
/>
```

### Key Details

1. **`key={currentExercise.id}`** on ChatInterface ensures clean chat state when navigating between exercises
2. **`max-w-4xl`** on primary content keeps exercise content readable while allowing chat to take full width
3. **New `storageKey="pager-split-size"`** separates persistence from ExerciseWorkspace

### CSS Structure

```tsx
<div className="min-h-screen bg-background flex flex-col">
  <Progress value={progressPercent} className="h-1.5 rounded-none" />

  {pageState.type === 'exercise' ? (
    // Exercise: Split layout fills remaining space
    <SplitPaneLayout className="flex-1" ... />
  ) : (
    // Intro/Outro: Centered column with max width
    <main className="flex-1 overflow-y-auto">
      <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-3xl">
        {/* ... existing intro/outro cards ... */}
      </div>
    </main>
  )}
</div>
```

---

## Step 5: Quality Checks

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Import map (if needed)
pnpm generate:importmap
```

---

## Files Changed Summary

| File                                          | Action   | Lines (+/-) |
| --------------------------------------------- | -------- | ----------- |
| `src/ui/web/components/split-pane-layout.tsx` | **NEW**  | +200        |
| `.../ExerciseWorkspace/index.tsx`             | **EDIT** | -220, +40   |
| `.../ExercisesPager/index.tsx`                | **EDIT** | +50         |
| `.../lessons/[lessonSlug]/page.tsx`           | **EDIT** | +1 prop     |
| `.../exercises/[exerciseSlug]/page.tsx`       | **EDIT** | +1 prop     |

---

## Dependencies & Imports

### New Component Dependencies

```
split-pane-layout.tsx imports:
  - @/infra/utils/ui (cn)
  - react (useEffect, useRef, useState)
  - @/ui/web/components/resizable-pane
  - @/server/payload/hooks/useMediaQuery
```

### Updated Component Dependencies

```
ExerciseWorkspace imports:
  - @/client/hooks/useCurrentUser
  - next/navigation (usePathname)
  - ../ExerciseHeader
  - @/ui/web/components/split-pane-layout

ExercisesPager imports:
  - @/ui/web/components/split-pane-layout
  - @/ui/web/chat
```

---

## Risk Assessment

| Risk                           | Level  | Mitigation                                                         |
| ------------------------------ | ------ | ------------------------------------------------------------------ |
| SplitPaneLayout extraction bug | Low    | Pure refactor, verify ExerciseWorkspace behavior unchanged         |
| Mobile layout conflicts        | Medium | Progress bar (`h-1.5`) + SplitPaneLayout (`flex-1`) should coexist |
| Chat state on exercise change  | Low    | `key={exerciseId}` forces remount, useNotebookChat handles reset   |
| localStorage key collision     | Low    | Separate `pager-split-size` from `exercise-split-size`             |

---

## What's NOT in Scope

- Slug backfill for existing exercises (no slugs → use ObjectID fallback)
- Progress persistence (separate feature)
- AI index updates (run `pnpm run ai:generate-patterns` after)
- Stale route references (already fixed in Phase 2)

---

## Verification Checklist

- [ ] ExerciseWorkspace behaves identically (fullscreen, split-pane, mobile toggle)
- [ ] ExercisesPager intro shows centered card, no chat
- [ ] ExercisesPager outro shows centered card, no chat
- [ ] ExercisesPager exercise shows split-pane with ChatInterface
- [ ] Mobile: PDF mode collapsed (chat input bar only)
- [ ] Mobile: PDF mode expanded (draggable handle)
- [ ] Mobile: Chat mode (full-screen chat)
- [ ] Desktop: Resizable split between exercise and chat
- [ ] Chat resets when navigating to different exercise
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

## References

- `ExerciseWorkspace` implementation: `.../exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx`
- `ResizablePane`: `src/ui/web/components/resizable-pane.tsx`
- `ChatInterface`: `src/ui/web/chat/ChatInterface/index.tsx`
- `ExercisesPager`: `.../_components/ExercisesPager/index.tsx`
- Previous task: `.tasks/20261002-lesson-step-pager-routing`
