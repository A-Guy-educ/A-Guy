---
title: Lesson Duplication
type: architecture
updated: 2026-05-07
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1454
---

# Lesson Duplication

**Status:** Partial — PR #1454 implements K1 only

## Overview

New `LessonDuplications` collection (job records with `level`, `status`, `outputLesson`, `failures`) and a Payload endpoint `POST /api/lessons/:id/duplicate`.

## Levels

| Level | Behavior |
|-------|----------|
| `none` | Deep-clones lesson + all exercises inline; sets `outputLesson`, marks `succeeded` |
| `light` | Creates pending record for later task processing (K3–K5) |
| `medium` | Creates pending record |
| `deep` | Creates pending record |

## Admin UI

"Duplicate" button on lesson edit view (`beforeDocumentControls`) opens a modal with four radio options. Both the new button and Payload's default duplicate coexist (hiding the latter has no clean API).

## In Scope (K1, done)

- `LessonDuplications` collection schema
- `POST /api/lessons/:id/duplicate` endpoint
- Admin modal with level selector
- Deep-clone path for `level=none`

## Out of Scope

- Light/medium/deep variation logic (K3, K4)
- Validators + failures review screen (K5, K6)
- i18n (deferred per product call)
- Hiding Payload's default duplicate button

## Related

- [Lesson Duplication Selectors](./lesson-duplication-selectors.md)
