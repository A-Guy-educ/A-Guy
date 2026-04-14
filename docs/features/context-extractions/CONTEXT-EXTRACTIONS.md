# Context Extractions: Decoupled PDF-to-Exercise Storage

## Problem

Previously, the "Convert Context" procedure extracted LaTeX from PDFs and stored the result directly in `Lesson.lessonContextText`. This field served double duty:

1. **Exercise creation pipeline**: Admin converts PDF → LaTeX stored in `lessonContextText` → ContextExerciseViewer parses it → "Create Exercises" creates Exercise documents
2. **Chat context injection**: At runtime, `lessonContextText` is injected into the LLM system prompt for student chat

These two concerns were coupled through a single field, making it impossible to modify one flow without affecting the other.

## Solution

A new hidden collection **`ContextExtractions`** stores the raw LaTeX output from PDF conversion, completely decoupled from `lessonContextText`.

### Data Flow (Before)

```
PDF → Convert Context → Lesson.lessonContextText → ContextExerciseViewer → Create Exercises
                                                  → Chat system prompt (runtime)
```

### Data Flow (After)

```
PDF → Convert Context → ContextExtractions.text → ContextExerciseViewer → Create Exercises

Lesson.lessonContextText → Chat system prompt (runtime)  [UNCHANGED]
```

## Architecture

### ContextExtractions Collection

- **Slug**: `context-extractions`
- **Hidden**: Not visible in admin navigation
- **Fields**:
  - `lesson` (relationship → Lessons, indexed)
  - `sourceMedia` (relationship → Media)
  - `text` (textarea, max 200K chars)
- **Access**: Admin-only (read, create, update, delete)
- **Timestamps**: Enabled (createdAt, updatedAt)

### API Endpoints

#### GET `/api/lessons/context-extraction?lessonId=xxx`
Returns the latest extraction text for a lesson.

**Response:**
```json
{
  "data": {
    "text": "\\documentclass{article}...",
    "extractionId": "abc123"
  }
}
```

#### PUT `/api/lessons/context-extraction`
Updates extraction text (used by ContextExerciseViewer for inline edits).

**Body:**
```json
{
  "extractionId": "abc123",
  "text": "\\documentclass{article}..."
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/server/payload/collections/ContextExtractions.ts` | New hidden collection |
| `src/payload.config.ts` | Register collection |
| `src/app/api/lessons/context-extraction/route.ts` | New API route (GET/PUT) |
| `src/server/services/lesson-context-conversion/extract-context.ts` | Write to `context-extractions` instead of `lesson.lessonContextText` |
| `src/ui/admin/exercise-conversion/ConvertContextModal/index.tsx` | Remove `useField({ path: 'lessonContextText' })`, dispatch refresh event |
| `src/ui/admin/context-exercise-viewer/index.tsx` | Fetch from API instead of `useField`, write edits via API |
| `src/app/api/lessons/create-context-exercises/route.ts` | Read from `context-extractions` instead of `lesson.lessonContextText` |

## What Stays Unchanged

- `Lesson.lessonContextText` field — still exists, still used by chat
- Chat pipeline (`prompt-composition.ts`, `lesson-context.ts`) — completely untouched
- `context-exercise-parser` — same parsing logic, just reads from different source
- Frontend `hasLessonContext` checks — still check `lessonContextText` for chat visibility

## Upsert Behavior

When "Convert Context" runs:
- **Replace mode**: Creates or updates the extraction for the lesson+media pair
- **Append mode**: Fetches existing extraction text, appends new text with `---` delimiter

The extraction is keyed by `(lesson, sourceMedia)` — each PDF gets its own extraction document per lesson.

## Communication Between Components

The `ConvertContextModal` dispatches a `context-extraction-updated` custom DOM event after successful extraction. The `ContextExerciseViewer` listens for this event and refreshes its data from the API.
