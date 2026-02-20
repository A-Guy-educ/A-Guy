# Plan: ExerciseWorkspace as Host Shell

**Date:** 2026-02-10
**Status:** Approved (awaiting implementation)
**Depends on:** Previous SplitPaneLayout extraction (completed)

## Goal

Make `ExerciseWorkspace` act as a generic host shell for any content type in its primary pane. The exercise pager renders inside `ExerciseWorkspace` for exercise steps (fullscreen overlay with sticky chat), while intro/outro render outside it (centered card, no overlay).

## Architecture

```
Lesson Page (server)
  ├── Has content files → <ExerciseWorkspace primaryContent={PDF} chatContent={Chat} />
  └── No content files, has exercises → <ExercisesPager />
       ├── Intro (centered card, no workspace)
       ├── Exercise steps → <ExerciseWorkspace primaryContent={ExerciseContent} chatContent={Chat} />
       └── Outro (centered card, no workspace)

Exercise Page [exerciseSlug] (server, deep-link/refresh)
  └── <ExercisesPager /> (hook reads URL → starts in exercise mode → workspace mounts immediately)
```

## User Flow

1. User lands on lesson page → sees **Intro** (centered card with Start button, no overlay)
2. User clicks **Start** → `ExerciseWorkspace` mounts as fullscreen overlay
   - Left pane: exercise content (header card + renderer + prev/next)
   - Right pane: ChatInterface (sticky, persistent within exercise)
3. User navigates exercises via **Prev/Next** → left pane content updates, chat resets per exercise
4. User clicks **Next** on last exercise → workspace unmounts → **Outro** (centered card)
5. User clicks **Prev** on outro → workspace re-mounts at last exercise

Deep-link refresh on `/exercises/:slug` → pager hook reads URL → exercise mode → workspace mounts immediately.

---

## Step 1: Rename `pdfContent` → `primaryContent` in ExerciseWorkspace

Semantic rename to reflect the component's role as a generic host shell.

### File: `ExerciseWorkspace/index.tsx`

```diff
 interface ExerciseWorkspaceProps {
   exerciseTitle: string
   backUrl?: string
-  pdfContent: React.ReactNode
+  primaryContent: React.ReactNode
   chatContent: React.ReactNode
 }

 export function ExerciseWorkspace({
   exerciseTitle,
   backUrl,
-  pdfContent,
+  primaryContent,
   chatContent,
 }: ExerciseWorkspaceProps) {
   ...
       <SplitPaneLayout
-        primaryContent={pdfContent}
+        primaryContent={primaryContent}
         chatContent={chatContent}
```

### File: `ExerciseWorkspace/exercise-workspace-types.ts`

```diff
 export interface ExerciseWorkspaceProps {
   exerciseTitle: string
   backUrl?: string
-  pdfContent: React.ReactNode
+  primaryContent: React.ReactNode
   chatContent: React.ReactNode
 }
```

### File: `lessons/[lessonSlug]/page.tsx`

```diff
       <ExerciseWorkspace
         exerciseTitle={lesson.title}
         backUrl={backUrl}
-        pdfContent={pdfContent}
+        primaryContent={pdfContent}
         chatContent={...}
       />
```

---

## Step 2: Update ExercisesPager to Use ExerciseWorkspace for Exercise Steps

### File: `ExercisesPager/index.tsx`

**Import changes:**

```diff
-import { SplitPaneLayout } from '@/ui/web/components/split-pane-layout'
+import { ExerciseWorkspace } from '../../../exercises/[exerciseSlug]/_components/ExerciseWorkspace'
```

(`ChatInterface` is already imported)

**Exercise step rendering — replace SplitPaneLayout with ExerciseWorkspace:**

When `pageState.type === 'exercise' && currentExercise`:

```tsx
return (
  <ExerciseWorkspace
    exerciseTitle={currentExercise.title}
    backUrl={backUrl}
    primaryContent={
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full py-6 px-4 sm:px-6 space-y-6">
          <Progress value={progressPercent} className="h-1.5 rounded-full" />

          {/* Exercise Header Card */}
          <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/60 shadow-lg shadow-muted/40 relative overflow-hidden">
            <div className="absolute top-0 end-0 w-1.5 h-full bg-primary rounded-s-full" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                  {exerciseOrdinal !== null
                    ? `${t('exercise')} ${exerciseOrdinal} ${t('of')} ${totalExercises}`
                    : ''}
                </p>
                <h2 className="text-xl font-medium text-foreground">
                  {currentExercise.title}
                </h2>
              </div>
            </div>
          </div>

          {/* Exercise Content Card */}
          <div className="bg-card rounded-3xl p-6 md:p-8 border border-border/60 shadow-lg shadow-muted/40">
            <ExerciseRenderer
              content={currentExercise.content as unknown as ExerciseContentData}
              mode="student"
              showCheckAnswer={true}
            />
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-4">
            <Button variant="ghost" onClick={handlePrev} disabled={!canGoPrev} ...>
              {t('exercisesPagerPrev')}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext} size="lg" ...>
              {t('exercisesPagerNext')}
            </Button>
          </div>
        </div>
      </div>
    }
    chatContent={
      <ChatInterface
        key={currentExercise.id}
        lessonId={lessonId}
        exerciseId={currentExercise.id}
        translationNamespace="courses"
        showMathTools={true}
      />
    }
  />
)
```

**Intro/outro rendering:** No changes. Keep existing centered card layout.

### Key Details

- **`key={currentExercise.id}`** on ChatInterface forces clean remount per exercise (separate conversation context)
- **`backUrl={backUrl}`** points to lesson URL — ExerciseHeader back arrow exits workspace
- **`exerciseTitle={currentExercise.title}`** — header title updates per exercise
- **`overflow-y-auto`** on primary content wrapper — exercise content may exceed viewport
- **Progress bar** renders inside the primary content pane (top of left pane)

---

## Step 3: No Other Files Change

| File                                | Status | Reason                                            |
| ----------------------------------- | ------ | ------------------------------------------------- |
| `SplitPaneLayout`                   | Keep   | Used internally by ExerciseWorkspace              |
| `useExercisesPager.ts`              | Keep   | State management + URL sync unchanged             |
| `exercises/[exerciseSlug]/page.tsx` | Keep   | Renders `<ExercisesPager>`, hook handles URL init |
| `ExerciseHeader`                    | Keep   | Receives title dynamically                        |
| `complete/page.tsx`                 | Keep   | Server-side outro page                            |

---

## Step 4: Quality Checks

```bash
pnpm tsc --noEmit
pnpm lint
```

---

## Files Changed Summary

| File                            | Action | Lines (+/-)                                    |
| ------------------------------- | ------ | ---------------------------------------------- |
| `ExerciseWorkspace/index.tsx`   | EDIT   | ~3 (rename prop)                               |
| `exercise-workspace-types.ts`   | EDIT   | ~1 (rename prop)                               |
| `lessons/[lessonSlug]/page.tsx` | EDIT   | ~1 (rename prop)                               |
| `ExercisesPager/index.tsx`      | EDIT   | ~20 (swap SplitPaneLayout → ExerciseWorkspace) |
| **Total**                       |        | ~25 lines                                      |

---

## Behavioral Matrix

| State                 | What Renders                                           | Layout                                | Chat                    |
| --------------------- | ------------------------------------------------------ | ------------------------------------- | ----------------------- |
| **Intro**             | Centered card + Start button                           | Normal page, no overlay               | None                    |
| **Exercise**          | `ExerciseWorkspace` fullscreen overlay                 | Split-pane: exercise left, chat right | Sticky, exercise-scoped |
| **Outro**             | Centered card + completion                             | Normal page, no overlay               | None                    |
| **Deep-link refresh** | `ExercisesPager` → exercise mode → `ExerciseWorkspace` | Same as Exercise                      | Same as Exercise        |

---

## Mobile Behavior

Inherited from ExerciseWorkspace → SplitPaneLayout:

| State                | Primary Pane                     | Chat                         |
| -------------------- | -------------------------------- | ---------------------------- |
| PDF mode (collapsed) | Full height exercise content     | Input bar only at bottom     |
| PDF mode (expanded)  | Partial height, draggable handle | Expanded, split with primary |
| Chat mode            | Hidden                           | Full screen                  |

---

## Risk Assessment

| Risk                                  | Level    | Mitigation                                                  |
| ------------------------------------- | -------- | ----------------------------------------------------------- |
| Workspace mount/unmount flash         | Low      | CSS `fixed inset-0` mounts instantly, no layout shift       |
| Chat state lost on exercise change    | Expected | `key={exerciseId}` forces clean remount per exercise        |
| Prev from outro re-entering workspace | Low      | `handlePrev` sets exercise state → workspace re-mounts      |
| ExerciseHeader back button behavior   | Low      | Uses `history.back()` or `backUrl`, exits overlay naturally |

---

## Verification Checklist

- [ ] PDF workspace still works (lesson with content files)
- [ ] Exercise pager intro renders centered card (no overlay)
- [ ] Clicking Start opens fullscreen workspace with exercise + chat
- [ ] Prev/next navigate between exercises within workspace
- [ ] Chat stays pinned in right pane during exercise navigation
- [ ] Chat resets on exercise change (key remount)
- [ ] Header title updates with current exercise name
- [ ] Clicking Next on last exercise exits workspace → outro
- [ ] Clicking Prev on outro re-enters workspace at last exercise
- [ ] Refreshing on `/exercises/:slug` opens workspace immediately
- [ ] Mobile: PDF/Chat toggle works
- [ ] Desktop: resizable split works
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

## References

- `ExerciseWorkspace`: `.../exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx`
- `SplitPaneLayout`: `src/ui/web/components/split-pane-layout.tsx`
- `ExercisesPager`: `.../_components/ExercisesPager/index.tsx`
- `useExercisesPager`: `.../_components/ExercisesPager/useExercisesPager.ts`
- `ChatInterface`: `src/ui/web/chat/ChatInterface/index.tsx`
- Previous plan: `.tasks/20260210-chat-pager-integration.md`
