---

## Verdict: PASS (with notes)

## Summary

The critical and major issues from the initial review have been addressed. The `courseId="default-course"` placeholder now has a proper fallback via `gradeLevel` lookup using the user's enrolled grade, and non-lesson topic pills now correctly have transitions. Minor issues remain but are not blocking.

## Findings

### Critical

None.

### Major

None.

### Minor

1. **`src/app/(frontend)/study-plan/_components/LessonSelector/index.tsx:109-112`** — `topicLabel` is derived by parsing the URL path (`ref.lessonUrl.split('/').pop()`) rather than from the lesson's actual title. This is fragile — if the URL structure changes, the label becomes wrong or empty. The `LessonRef` type should carry `lessonTitle` from the API response so the label is always the human-readable lesson title.

**Suggested fix**: Add `lessonTitle: string` to `LessonRef` and `SyllabusLesson`, then use it directly:
```typescript
topicLabel: ref.lessonTitle ?? ref.lessonUrl.split('/').pop()
```

2. **`src/app/api/course-syllabus/route.ts:52`** — Uses plain `lesson.type ?? 'learning'` instead of the existing `getEffectiveLessonType(lesson.type)` from `@/server/constants/lesson-types`, which also handles invalid string values gracefully. Minor inconsistency.

**Suggested fix**: Import `getEffectiveLessonType` and use it for consistency.

---

## Two-Pass Review

**Pass 1 — CRITICAL (must fix before merge):**

### SQL & Data Safety

- **N/A** — No direct SQL; uses Payload ORM.

### Race Conditions & Concurrency

- **N/A** — No concerning patterns.

### LLM Output Trust Boundary

- **N/A** — No LLM output.

### Shell Injection

- **N/A** — No shell commands.

### Enum & Value Completeness

- **N/A** — `lessonType` values validated at DB level with `getEffectiveLessonType` fallback used in consumers. No completeness gap.

**Pass 2 — INFORMATIONAL (should review, may auto-fix):**

### Conditional Side Effects

- No issues.

### Test Gaps

- No unit tests added for `LessonSelector` component.
- No integration tests for the `course-syllabus` API route.
- The plan mentioned `study-plan/engine.spec.ts` extension and new test files, but none appear in the diff.

### Dead Code & Consistency

- No dead code.

### Design System Compliance

- **Fixed**: Non-lesson pills in `DayCard` now have `transition-all duration-normal` (line 188).
- All interactive elements have appropriate transitions.
- Semantic colors used throughout (`bg-muted`, `text-foreground`, `text-primary`, etc.).
- `cn()` used for className composition throughout.

### Crypto & Entropy

- `Date.now()` used in `topicId` generation (line 113 of `StudyPlanPage.tsx`) — theoretical collision risk if the same lesson is added twice in the same millisecond. Low risk in practice, but `crypto.randomUUID()` would be more robust.

### Performance & Bundle Impact

- No performance concerns. `LessonSelector` fetches once on mount with proper AbortController cleanup. No waterfall.
