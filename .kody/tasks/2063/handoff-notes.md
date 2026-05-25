# Fix for Issue #2063: Login button hangs indefinitely with QA credentials

## What I Fixed

**Root Cause**: The `claimGuestConversations` function in `loginAction` had no timeout. If the guest session upgrade operation hangs (due to a slow/stuck database operation), `loginAction` would wait forever and never return. This caused the login button to show "Logging in..." indefinitely.

**Fix**: Added a `withTimeout` helper function that wraps `claimGuestConversations` with a 5-second timeout. If the guest claim takes longer than 5 seconds, it logs a warning and continues, allowing the login to succeed.

## Files Changed

1. **src/app/(frontend)/login/login_authenticate-action.ts**
   - Added `withTimeout<T>` helper function (lines 27-51)
   - Wrapped `claimGuestConversations` call with `withTimeout(..., 5000, ...)` (lines 113-117)
   - Added specific handling for timeout errors in the catch block (lines 131-139)

2. **tests/int/auth-login-hang.int.spec.ts** (new file)
   - Regression test that proves the fix works
   - Mocks `claimGuestConversations` to never resolve
   - Verifies `loginAction` returns within the timeout period

## Behavior Change

- **Before**: If `claimGuestConversations` hangs, login hangs forever
- **After**: If `claimGuestConversations` hangs for more than 5s, login succeeds with a warning logged

The guest session upgrade is a best-effort operation. A timeout failure logs a warning but does NOT fail the login. The cookie is retained so the upgrade could theoretically be retried later (though no retry mechanism currently exists).
