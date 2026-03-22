# Build Agent Report: 260314-fix-github-token-error

## Changes

- **Fixed error message mismatch in `src/app/api/cody/tasks/route.ts`** (line 338-343)
  - Changed the catch clause to detect token errors with a more robust check
  - Now matches both old format ("GITHUB_TOKEN not configured") and new format ("Neither CODY_BOT_TOKEN nor GITHUB_TOKEN is configured")
  - Returns proper 401 with `error: 'no_token'` so client throws `NoTokenError`

- **Replaced local getOctokit() with shared import**
  - `src/app/api/cody/tasks/approve/route.ts` - removed local function, now imports from `github-client`
  - `src/app/api/cody/tasks/approve-review/route.ts` - removed local function, now imports from `github-client`
  - `src/app/api/cody/publish/route.ts` - removed local function, now imports from `github-client`
  - `src/app/api/cody/tasks/[taskId]/actions/route.ts` - replaced inline Octokit with shared `getOctokit()` for approve-pr action
  - This ensures all routes check for both `CODY_BOT_TOKEN` and `GITHUB_TOKEN`

- **Updated error messages for better UX**
  - `src/ui/cody/api.ts` - updated `NoTokenError` default message to mention both token options
  - `src/ui/cody/components/CodyDashboard.tsx` - now shows dynamic error message instead of hardcoded string

## Tests Written

- `tests/unit/cody-dashboard-token-error.test.ts` - 5 tests verifying:
  - Error detection for new message format
  - Error detection for old message format (backward compat)
  - No false positives for unrelated errors
  - NoTokenError default message mentions both tokens

## Deviations

None — plan followed exactly.

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: PASS (3554 tests passed)
