## CodeQL Fix for dev CI

### Issue
CodeQL scan was failing on `dev` branch at commit `b123a1349` due to "user-controlled format string" vulnerability in `console.error` calls.

### Root Cause
Both `pdf-to-exercises-task.ts` and `pdf-to-exercises-v2-task.ts` used template literal interpolation to insert `job.id` into `console.error` calls:
```typescript
// Vulnerable - template literal with user-controlled input
console.error(`[PDF→Exercises] Job ${job.id} failed:`, error)
```

This is a format string vulnerability because user-controlled data is interpolated into the format string, allowing format specifier injection.

### Fix Applied
Replaced template literal with comma-separated arguments (safest approach — no string interpolation):
```typescript
// Fixed - comma-separated arguments, no interpolation
console.error('[PDF→Exercises] Job', job.id, 'failed:', error)
```

### Files Changed
- `src/server/payload/jobs/pdf-to-exercises-task.ts` — line 347
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` — line 277

### Verification
- Quality gates: PASSED (typecheck, lint, unit tests)
