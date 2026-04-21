# Bug: OAuth race recovery returns 302 with no Location header or session token

## Bug Description

In `handleRaceCondition` in `src/app/api/oauth/google/callback/oauth_callback_helpers.ts` (lines 227-245), when a duplicate key error is detected during user creation and the race-recovery finds the existing user, if the user has `oauthLoginSecretEnc` set (the normal case), the function logs the event and returns `res` — but **without setting a `Location` header or issuing a session token**.

```typescript
if (retryUser.docs.length > 0) {
  const user = retryUser.docs[0]

  if (!user.oauthLoginSecretEnc) {
    res.headers.set('Location', ...)  // Error case handled correctly
    return res
  }

  // SUCCESS CASE: logs but does NOT:
  // - Set Location header for redirect
  // - Issue session token / set auth cookie
  await logOAuthEvent('user_created_race_recovery', { ... })
  return res  // Returns 302 with no Location, no auth cookie
}
```

## Impact

When a rare OAuth race condition occurs (two concurrent sign-ups with the same Google account), the user gets a broken redirect (302 with no Location header). The browser may display a blank page. The user's account was created but they cannot log in from this flow.

## Suggested Fix

After finding the recovered user, issue a session token, set the auth cookie, and set the `Location` header to the returnTo URL, matching the pattern in `handleExistingUser`.