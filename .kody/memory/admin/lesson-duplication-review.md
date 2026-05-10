---
title: Lesson Duplication Admin Review Screen
type: runbook
updated: 2026-05-10
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1548
---

When the lesson duplication orchestrator finishes with failures, the `LessonDuplications` record enters `needs_review` status. Admins resolve failures via the review screen.

## Routes

- `GET /admin/lesson-duplications` — list all duplication records (Payload admin)
- `GET /admin/lesson-duplications/:id` — review screen for a specific record
- `POST /api/lesson-duplications/:id/resolve` — marks a failure as resolved (`resolved: true`)
- `POST /api/lesson-duplications/:id/record` — records a failure against a duplication record

## Review Screen

The `LessonDuplicationReview` component (`src/ui/admin/LessonDuplicationReview/`) shows each failed exercise with its error details and a resolve action. The sidebar shows a `SidebarLink` for navigation from the main list.

## Resolution Flow

1. Admin inspects a failure in the review screen
2. Optionally fixes the output lesson manually
3. Calls `POST /api/lesson-duplications/:id/resolve` with the failure ID
4. When all failures are resolved, the record status clears `needs_review`

## Related

- [Lesson Duplication Service](../architecture/lesson-duplication.md)
