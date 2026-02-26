# Task

## Issue Title

[MEDIUM] Security: Missing Zod validation on conversion queue API endpoints
## Description
Two API endpoints destructure request bodies directly without Zod validation at the API boundary. Malformed requests could pass unexpected types to downstream logic.

## Files Affected
- `src/app/api/exercises/convert/queue/route.ts` — line 62:
  ```typescript
  const { lessonId, mediaId, extractorPromptId, verifierPromptId } = await request.json()
  ```
- `src/app/api/exercises/convert/queue-v2/route.ts` — line 61:
  ```typescript
  const { lessonId, mediaId } = await request.json()
  ```

## Expected Fix
Add Zod schemas:
```typescript
const queueRequestSchema = z.object({
  lessonId: z.string().min(1),
  mediaId: z.string().min(1),
  extractorPromptId: z.string().optional(),
  verifierPromptId: z.string().optional(),
})

const body = queueRequestSchema.parse(await request.json())
```

## Priority
MEDIUM — Input validation gap on API boundary
