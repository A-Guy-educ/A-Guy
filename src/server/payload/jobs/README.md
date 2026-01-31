# Payload Background Jobs

**Purpose**: Long-running tasks and scheduled operations.

## Quick Reference (~150 tokens)

```typescript
import type { Job } from 'payload'

export const myJob: Job = {
  slug: 'my-job',
  handler: async ({ req, job }) => {
    // Process in background
    return { success: true }
  },
}
```

---

## Available Jobs

| Job | Purpose | Trigger |
|-----|---------|---------|
| `pdf-to-exercises-task` | Convert PDF to exercises | Manual/API |
| `media-expiry-cleanup` | Remove expired media | Scheduled |

---

## Job Pattern

```typescript
import type { Job } from 'payload'

export const pdfToExercisesTask: Job = {
  slug: 'pdf-to-exercises',
  handler: async ({ req, job }) => {
    const { fileId, lessonId } = job.input

    // Process PDF
    const exercises = await convertPdfToExercises(fileId)

    // Save exercises
    await req.payload.create({
      collection: 'exercises',
      data: exercises,
      req,
    })

    return { success: true, count: exercises.length }
  },
}
```

---

## Running Jobs

```typescript
// Trigger job
await req.payload.jobs.run({
  job: 'pdf-to-exercises',
  input: { fileId: 'xxx', lessonId: 'yyy' },
})
```

---

## Related Documentation

- Endpoints: [`../endpoints/README.md`](endpoints/README.md)
- Services: [`../../services/`](../../services/)
