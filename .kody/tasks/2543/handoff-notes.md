## Issue #2543: Custom lesson duplication review screen renders blank

### What was fixed

`src/app/(payload)/admin/lesson-duplications/[id]/page.tsx` — LessonDuplicationReviewPage

**Root cause:** Next.js 15 `useParams()` returns `Params` where `Params = Record<string, ParamValue>` and `ParamValue = string | Array<string> | undefined`. The original code did `params.id as string`, which:
1. Silently ignored the `string[]` case (would corrupt API URLs like `/api/lesson-duplications/a,b,abc123/record`)
2. Silently ignored the `undefined` case (would call API with `undefined` in URL, causing errors and a blank page)

**Fix:** Normalize params before use:
```tsx
const rawId = params?.id
const duplicationId = Array.isArray(rawId) ? rawId[0] : rawId
if (!duplicationId) {
  return <div style={errorStyle}>Invalid or missing duplication ID.</div>
}
```

Note: React hooks rules require `useCurrentUser()` to be called before any conditional return — the fix preserves this by calling `useCurrentUser()` unconditionally first, then checking `duplicationId` validity.

### Files changed
- `src/app/(payload)/admin/lesson-duplications/[id]/page.tsx` — normalize params.id, guard missing ID
- `tests/e2e/lesson-duplication-review.e2e.spec.ts` — added regression test for blank-page bug

### Verification
- TypeScript: clean (tsc --noEmit)
- ESLint: clean (no errors on changed files)
- Integration tests: 8/8 passing (lesson-duplication-review-resolve.int.spec.ts)
- E2E tests: not run (requires production build — run `pnpm build` then E2E suite)
