# Remove lessonContextText field from Lessons collection

# Remove `lessonContextText` Field from Lessons Collection

The `lessonContextText` textarea field on the Lessons collection should be removed entirely, along with all code that reads or injects it.

---

## Background

After the context extraction refactor (PR #1200), the conversion pipeline now writes to the `ContextExtractions` collection instead of `Lesson.lessonContextText`. This means **nothing populates `lessonContextText` anymore** — the field is effectively orphaned. The chat injection pipeline still reads from it, but it's always empty for new conversions. This cleanup removes the dead field and all code referencing it.

---

## Files to Modify

### 1. Field Definition — Remove field from schema
- **`src/server/payload/collections/Lessons.ts:339-347`** — Remove the `lessonContextText` field definition

### 2. Chat Injection — Remove lesson context injection from LLM pipeline

- **`src/infra/llm/lesson-context.ts`** — Delete entire file (`buildLessonContextPrompt()`, `LESSON_CONTEXT_MAX_CHARS`, delimiter constants)
- **`src/infra/llm/prompt-composer.server.ts`** — Remove step 6 (lesson context injection via `buildLessonContextPrompt()`) from `composeSystemInstructions()`; remove `lessonContextText` parameter
- **`src/server/payload/endpoints/agent/chat/prompt-composition.ts`** — Remove `lessonContextText` from return values of `fetchLessonContext()`, `fetchExerciseLessonContext()`, `fetchLessonContextForContext()`; also remove fallback logic `lessonContextText || courseContextText` in `composeFullSystemInstructions()`
- **`src/server/payload/endpoints/agent/chat/pipeline.ts:219-235`** — Stop passing `lessonContextText` to system instruction composition

### 3. Frontend — Remove `hasLessonContext` gating

The `hasLessonContext` boolean (derived from `lessonContextText`) controls ChatInterface visibility alongside `hasExercises`. Since `hasExercises` already independently gates chat visibility, remove the `hasLessonContext` prop entirely:

- **`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx:125`** — Remove `const hasLessonContext = Boolean(lesson.lessonContextText?.trim())` and all usages passing it to pagers
- **`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/LessonPager/index.tsx`** — Remove `hasLessonContext` prop (line 54); update conditional `hasLessonContext || hasExercises` → just `hasExercises`
- **`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`** — Same: remove prop, update conditional
- **`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/PdfLessonPager/index.tsx`** — Same: remove prop, update conditional

### 4. Types — Regenerate
- Run `pnpm generate:types` after schema change to update `src/payload-types.ts`

---

## Files NOT to Touch (independent systems)

- `src/server/payload/collections/ContextExtractions.ts` — independent extraction storage, stays
- `src/ui/admin/context-exercise-viewer/index.tsx` — reads from ContextExtractions API, not lessonContextText
- `src/ui/admin/exercise-conversion/ConvertContextButton/` — triggers extraction to ContextExtractions
- `src/ui/admin/exercise-conversion/ConvertContextModal/` — same
- `src/app/api/lessons/convert-context/route.ts` — writes to ContextExtractions, not lessonContextText
- `src/app/api/lessons/context-extraction/route.ts` — reads/writes ContextExtractions
- `src/app/api/lessons/create-context-exercises/route.ts` — reads from ContextExtractions
- `src/server/services/lesson-context-conversion/extract-context.ts` — writes to ContextExtractions
- `src/lib/context-exercise-parser/index.ts` — used by ContextExtractions flow
- `src/server/payload/collections/Courses.ts` (`courseContextText`) — separate field, stays

---

## Verification

1. `pnpm generate:types` succeeds
2. `pnpm typecheck` passes
3. `pnpm lint` passes
4. `pnpm test:int` passes
5. Grep for `lessonContextText` returns zero results (excluding auto-generated payload-types.ts)
6. Grep for `buildLessonContextPrompt` returns zero results
7. Grep for `hasLessonContext` returns zero results
8. Admin panel loads without errors for a lesson
9. Chat still works for lessons with exercises (now gated only on `hasExercises`)
10. Convert Context flow still works (writes to ContextExtractions, unaffected)

---

## Discussion (2 comments)

**@yaeliavni** (2026-04-15):
@kody

**@aguyaharonyair** (2026-04-15):
🚀 Kody pipeline started: `1225-260415-142959` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24460338817))

