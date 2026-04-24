# Bug: OAuth login race condition temporarily corrupts user password hash

## Bug Description

`issueSessionForLinkedAccount` in `src/infra/auth/oauth_session.ts` (lines 108-164) temporarily overwrites a user's real password hash with a temporary secret to perform `payload.login()`, then attempts to restore the original hash.

```typescript
// Line 114-121: Temporarily set OAuth secret as password
await payload.update({
  collection: 'users',
  id: userId,
  data: { password: tempSecret },  // User's real password is GONE
  overrideAccess: true,
})

// Line 124-130: Login to get real Payload JWT
const loginResult = await payload.login({ ... password: tempSecret })

// Line 137-145: Restore original password hash
await db.collections.users.updateOne(...)
```

Between the password swap and restore, any concurrent authentication attempt (email/password login or another OAuth callback for the same user) will fail or see the wrong password hash.

## Impact

**Critical**. Users can be locked out of email/password login during the race window. In serverless environments with concurrent function invocations, this is a real risk. If the restore operation fails (network error, timeout), the user's password hash is permanently corrupted.

## Suggested Fix

Generate the JWT token directly using `jsonwebtoken` with the same secret Payload uses, or use a database transaction to make the update-login-restore atomic. Avoid the destructive password swap pattern entirely.