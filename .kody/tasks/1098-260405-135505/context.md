
### taskify (2026-04-05T14:08:01)
TypeScript compiles successfully. 

**Summary of the fix:**

1. **Added `returnTo` parameter** to `handleRaceCondition` (line 212)

2. **Updated the call site** in `createNewOAuthUser` (line 188) to pass `returnTo`

3. **Fixed the success case** (lines 247-258): When race recovery finds an existing user with `oauthLoginSecretEnc` set, the code now:
   - Issues a session using `issueSession(user.email, user.oauthLoginSecretEnc!)`
   - Sets the `Location` header to the `returnTo` URL
   - Sets the
...(truncated)

### build (2026-04-05T14:11:18)
TypeScript compiles successfully. The fix is complete. Here's a summary of the changes:

**Changes made to `src/app/api/oauth/google/callback/oauth_callback_helpers.ts`:**

1. **Added `returnTo` parameter** to `handleRaceCondition` (line 212)

2. **Updated the call site** in `createNewOAuthUser` (line 188) to pass `returnTo`

3. **Fixed the success case** (lines 247-258): When race recovery finds an existing user with `oauthLoginSecretEnc` set, the code now:
   - Issues a session using `issueSes
...(truncated)
