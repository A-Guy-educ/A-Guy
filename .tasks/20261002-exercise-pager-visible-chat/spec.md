# Visible Chat In Exercises Pager (Lesson-Scoped)

Date: 2026-02-10
Owner: OpenCode (spec)
Status: Draft

## PRD

### Goal

When a lesson has no attached document/PDF and we render the in-lesson `ExercisesPager`, show a visible chat panel next to the pager content, matching the existing “lesson document + ChatInterface” usage pattern.

### User Problem

Today, lessons with PDFs get a persistent helper chat beside the document, but lessons without PDFs fall back to `ExercisesPager` with no visible chat. Users lose immediate assistance while working through exercises.

### Key Decision (Locked)

- Chat scope remains lesson-scoped: conversation context key is `lessons:${lessonId}`.
- This work is UI-only: no new chat backend features, no new data model.

### Requirements

- Desktop: show `ExercisesPager` content and `ChatInterface` side-by-side in a resizable split layout (same interaction model as the existing lesson PDF view).
- Mobile: follow the same interaction model as the existing workspace (content vs chat modes; no forced side-by-side).
- Chat must not remount when paging between intro/exercise/outro inside `ExercisesPager`.
- Chat must be lesson-scoped (do not pass `exerciseId` in this mode).
- Preserve existing `ExercisesPager` UX/content (intro/exercise/outro pages, progress behavior) inside the content pane.

### Out Of Scope

- Improving model grounding on “current exercise page” (beyond what the UI already provides).
- Changing chat history semantics, storage, or API contracts.
- Reworking `ExercisesPager` routing (it is currently local-state driven).

### Success Metrics (Practical)

- A lesson with no `contentFiles` renders a persistent chat panel on desktop.
- Switching `ExercisesPager` pages does not clear chat history, does not lose input focus unexpectedly.
- Chat history remains stable across refresh due to `lessonId` scoping.

## HLS

### Current State (Relevant)

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`
  - If lesson has document(s): renders `ExerciseWorkspace` with `pdfContent` + `ChatInterface(lessonId=lesson.id)`.
  - If lesson has no document(s): renders `ExercisesPager` only.
- `src/ui/web/chat/hooks/useNotebookChat.ts`
  - Context priority: `exerciseId` overrides `lessonId`. To keep lesson-scoped chat, ensure `exerciseId` is not provided.

### Proposed Approach

Introduce a shared “content + chat workspace” layout abstraction and use it to wrap `ExercisesPager` in the no-document lesson branch.

Rationale:

- Reuses the exact split-pane and mobile mode behavior already proven in `ExerciseWorkspace`.
- Avoids creating a new route/page.
- Keeps `ExercisesPager` intact and simply mounts it as the left/content pane.

### UI/UX Contract

- Desktop layout:
  - Left pane: `ExercisesPager` (scrollable, retains its internal progress bar and sections).
  - Right pane: `ChatInterface` (full mode), lesson-scoped (`lessonId` only).
  - Resizable divider persists (same `storageKey` behavior as existing workspace).
- Mobile layout:
  - Default: show content (pager).
  - Chat accessible via the same mode toggle pattern used in existing workspace.

### Chat Contract

- `ChatInterface` props in this mode:
  - `lessonId = lesson.id`
  - `translationNamespace = "courses"`
  - `showMathTools = true` (match current lesson PDF view)
  - Do NOT pass `exerciseId`.

### Risks / Guardrails

- Critical: If `exerciseId` is accidentally passed, chat becomes exercise-scoped (`exercises:${exerciseId}`) due to priority ordering.
- Critical: Do not key `ChatInterface` on pager state/pathname; keying must remain stable for the whole lesson.
- Medium: Avoid forcing server-rendered content into client-only rendering; keep the layout split component client-side, but don’t change the data-fetching strategy of the lesson page.

## LLP

### Stage 1 (Timebox: 1–2h) — Extract Shared Workspace Layout

Deliverable: a reusable layout component that renders “left content + right chat” with desktop resizable split and mobile mode switching.

Implementation notes:

- Extract from `src/app/(frontend)/courses/.../exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx`.
- Keep behavior identical:
  - Desktop uses `ResizablePane`.
  - Mobile uses CSS show/hide modes and the `ChatInterface` cloning contract (`displayMode`, `isMobile`, `viewMode`, `onModeToggle`, `onChatInteraction`).
- Component placement:
  - Prefer `src/ui/web/...` if it becomes cross-route UI.
  - Keep route-specific wrappers (`ExerciseWorkspace`) in their existing location as thin composition layers.

Acceptance criteria:

- Existing lesson PDF view and exercise view can be migrated to the extracted component without UI/behavior change.

### Stage 2 (Timebox: 1h) — Wrap ExercisesPager With Workspace + Chat

Deliverable: no-document lesson branch renders pager + visible chat.

Changes:

- In `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`, when `!hasContent && hasExercises`, render the shared workspace layout:
  - Left/content: `<ExercisesPager ... />`
  - Right/chat: `<ChatInterface lessonId={lesson.id} translationNamespace="courses" showMathTools />`

Acceptance criteria:

- Desktop shows pager and chat side-by-side.
- Chat remains lesson-scoped and does not reset while paging inside pager.

### Stage 3 (Timebox: 1–2h) — Tests / Gates

Deliverable: regression coverage for the new UI.

Add/extend E2E tests:

- New test: “lesson without PDF shows chat beside exercises pager”
  - Navigate to a lesson with `contentFiles` empty but exercises present.
  - Assert chat input exists.
  - Page through intro → exercise → outro and assert chat input still exists and typed input persists.

Quality gates (must pass):

- `pnpm -s tsc --noEmit`
- `pnpm -s lint`
- Relevant `pnpm test:e2e` subset if available for lesson/chat flows.

## Open Questions

- None for scope/behavior. This spec assumes the left pane remains the existing `ExercisesPager` UI, and the new work only adds the right-side chat workspace.
