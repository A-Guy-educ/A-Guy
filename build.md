# Build Agent Report: cody-github-token-expired-redirect

## Changes

- **src/ui/cody/api.ts**: Added `redirectToLogin(returnTo?: string)` helper function that redirects to GitHub OAuth with a returnTo parameter. This handles expired credentials by redirecting users to re-authenticate.

- **src/ui/cody/components/CodyDashboard.tsx**:
  - Imported `redirectToLogin` from api.ts
  - Added `handleAuthError` helper function that checks if an error is `SessionExpiredError` and triggers redirect
  - Updated 5 mutations to use the handler: `assignMutation`, `unassignMutation`, `executeMutation`, `stopMutation`, `mergeMutation`

- **src/ui/cody/components/BugReportDialog.tsx**:
  - Imported `SessionExpiredError` and `redirectToLogin`
  - Added `onError` handler to `createBug` mutation that redirects to `/cody/bug` on session expiry

- **src/ui/cody/components/BranchCleanupDialog.tsx**:
  - Imported `SessionExpiredError` and `redirectToLogin`
  - Updated `bulkDeleteMutation` to redirect to login on session expiry

## Tests Written

- No new tests required — this is a UX fix that handles an existing error type

## Deviations

- None — implemented exactly as requested

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: PASS (4025 tests passed)
