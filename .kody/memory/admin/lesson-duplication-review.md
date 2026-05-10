---
title: Lesson Duplication Admin Review
type: runbook
updated: 2026-05-10
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1548
---

Admin review interface for resolving lesson duplication failures. Accessible at `/admin/lesson-duplications/:id` and the list view at `/admin/lesson-duplications`.

## Purpose

When the lesson duplication orchestrator completes with failures, the record enters `needs_review` status. Admins review each failure and decide how to handle it.

## Resolution Actions

Each failed exercise supports three actions:
- **Skip**: Mark as resolved, exclude from output lesson
- **Regenerate**: Re-run variation at specified level (light/medium/deep)
- **Keep**: Include the output as-is despite the failure

## Resolution API

`POST /api/lesson-duplications/:id/resolve` accepts:
```json
{
  "exerciseRef": "section_2:ex_1",
  "action": "skip" | "regenerate" | "keep",
  "regenLevel": "light" | "medium" | "deep"
}
```

## Data Model

`LessonDuplications.failures[]` stores:
- `exerciseRef`: section index + exercise ID (e.g., `"2:ex_1"`)
- `code`: failure type (e.g., `MISSING_QUESTION`, `VALIDATION_FAILED`)
- `message`: human-readable description
- `suggestedAction`: recommended resolution (`regenerate`, `skip`)
- `resolved`: boolean flag

## Related

- [lesson-duplication](../lesson-duplication.md) — Orchestrator behavior and failure tracking
- [design-system](../design-system.md) — UI patterns for admin components
