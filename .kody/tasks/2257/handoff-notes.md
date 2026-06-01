# Task 2257: Fix dev CI failures (refresh, CodeQL) at 69cbb7e5a

## What was done

Fixed two CI failures on dev branch at commit 69cbb7e5a:

### 1. CodeQL Format String Vulnerability (HIGH severity)
**Files changed:**
- `src/server/payload/jobs/pdf-to-exercises-task.ts` (line 347)
- `src/server/payload/jobs/pdf-to-exercises-v2-task.ts` (line 277)

**Problem:** Template literal `console.error(`[PDF→Exercises] Job ${job.id} failed:`, error)` is flagged by CodeQL as "Use of externally-controlled format string" because `job.id` is user-controlled data interpolated into a string.

**Fix:** Reverted to comma-separated arguments:
```typescript
console.error('[PDF→Exercises] Job', job.id, ' failed:', error)
console.error('[V2] Job', job.id, ' failed:', error)
```

### 2. AI Docs Refresh pnpm Setup Failure
**File changed:** `.github/workflows/ai-docs-refresh.yml`

**Problem:** The `pnpm/action-setup@v4` action was configured with `version: 9` which fails to install pnpm in the GitHub Actions runner.

**Fix:** Changed version to `10.33.0` (matching the project's lockfile version and the fix applied to `inspector.yml` in commit `16d298b44`).

## Verification
- Typecheck: PASS
- ESLint: PASS
- Format check: PASS
- Quality gates (verify tool): PASS
