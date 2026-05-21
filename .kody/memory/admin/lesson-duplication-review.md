---
title: Lesson Duplication Admin Review Screen
type: component
updated: 2026-05-11
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1548
  - https://github.com/A-Guy-educ/A-Guy/pull/1556
---

Admin interface for reviewing and resolving lesson duplication failures. Surfaces when the orchestrator finishes with `needs_review` status.

## Routes

| Path | Purpose |
|------|---------|
| `/admin/lesson-duplications` | List all duplication records |
| `/admin/lesson-duplications/[id]` | Review specific duplication |

## API Endpoints

- `GET /api/lesson-duplications/[id]/record` — Returns the full duplication record including failures
- `POST /api/lesson-duplications/[id]/resolve` — Marks a failure as resolved by admin action

## UI Components

- `LessonDuplicationReview/index.tsx` — Main review screen container
- `LessonDuplicationReview/DiffPreview/` — Side-by-side diff preview
  - `AdminBlockRenderer.tsx` — Renders exercise content blocks with admin annotations
  - `DiffBadge.tsx` — Shows diff type (added/changed/removed)
  - `ExercisePair.tsx` — Displays source vs output exercise side-by-side
- `SidebarLink/index.tsx` — Navigation link in admin sidebar

## Diff Service

Diff logic lives at multiple levels:

- `src/utils/diff.ts` — Core diff utilities
- `src/server/services/diff.ts` — Server-side diff service wrapper
- `src/server/services/lesson-duplication/diff.ts` — Domain-specific diff for lesson content

## Resolution Flow

1. Admin opens `/admin/lesson-duplications/[id]`
2. System fetches record via `GET /api/lesson-duplications/[id]/record`
3. Admin reviews each failure (viewing side-by-side diff)
4. Admin takes action (regenerate, accept, or manually fix)
5. Resolution posted via `POST /api/lesson-duplications/[id]/resolve`
6. Failure marked `resolved: true` on the `LessonDuplications` record

## Related

- [lesson-duplication](../lesson-duplication.md) — Service architecture
- [design-system](../design-system.md) — UI patterns
