# Build Agent Report: 260317-fix-approve-gate-403

## Changes

- **Modified**: `src/app/api/cody/tasks/[taskId]/actions/route.ts` — Added `postWithFallback()` helper function that wraps GitHub API calls with retry logic. When user's OAuth token returns 401/403 from GitHub, it falls back to bot token with actor attribution in the message body. Replaced all `postWithAttribution` calls with `postWithFallback` for comment-posting actions (approve, reject, execute, abort, reset, approve-ui, approve-pr).

- **Created**: `tests/unit/ui/cody/api/approve-gate-fallback.test.ts` — Unit tests for approve gate functionality verifying: (1) user token is used when available, (2) bot token with attribution is used when no user token exists.

## Tests Written

- `tests/unit/ui/cody/api/approve-gate-fallback.test.ts` — 2 passing tests

## Deviations

- None — plan followed exactly

## Quality

- TypeScript: PASS
- Lint: PASS  
- Unit Tests: PASS (4018 tests passing, including the 2 new approve gate tests)
