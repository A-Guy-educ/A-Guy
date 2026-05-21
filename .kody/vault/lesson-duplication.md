---
title: Lesson Duplication
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1454
  - https://github.com/A-Guy-educ/A-Guy/pull/1449
---

# Lesson Duplication

## Overview

Admin feature to duplicate lessons with optional variation levels for content generation.

## Variation Levels

| Level | Behavior |
|-------|----------|
| `none` | Deep-clone immediately inline |
| `light` | Create pending record for later processing |
| `medium` | Create pending record for later processing |
| `deep` | Create pending record for later processing |

## Collection: `LessonDuplications`

```typescript
interface LessonDuplication {
  level: 'none' | 'light' | 'medium' | 'deep'
  status: 'pending' | 'succeeded' | 'failed'
  outputLesson?: string  // Populated on success
  failures?: number
}
```

## Endpoint

```
POST /api/lessons/:id/duplicate
Authorization: Admin
```

Request body:
```typescript
{ level: 'none' | 'light' | 'medium' | 'deep' }
```

## K1 Implementation (Done)

- `LessonDuplications` collection
- Duplicate endpoint
- Admin "Duplicate" button on lesson edit view
- Modal with four radio options
- `none` level: deep-clone inline

## Planned (K3-K6)

- K3: Light variation logic
- K4: Medium/deep variation logic
- K5: Validators
- K6: Failures review screen

## Selectors

Used for scaling exercise/section selection during variation:
- `selectExercisesScaled`: max 20 exercises
- `selectSectionsScaled`: max 5 sections

See [selectors-algorithm](./selectors-algorithm.md)

## Related

- [selectors-algorithm](./selectors-algorithm.md)
