# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

[HIGH] Bug: ExerciseAssets uses local staticDir instead of Vercel Blob
## Description
The `ExerciseAssets` collection uses `upload: { staticDir: 'exercise-assets' }` for file storage. Per project rules (AGENTS.md): *"Do NOT use upload: { staticDir: ... } - use Vercel Blob instead"*. Files stored on the local filesystem won't persist across serverless deployments.

## Files Affected
- `src/server/payload/collections/ExerciseAssets.ts` — line 15

## Current Code
```typescript
upload: {
  staticDir: 'exercise-assets',  // ❌ Local filesystem
}
```

## Expected Fix
Migrate to Vercel Blob adapter (follow the pattern used by other upload collections like Media).

## Priority
HIGH — Files lost on deployment in serverless environment


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
