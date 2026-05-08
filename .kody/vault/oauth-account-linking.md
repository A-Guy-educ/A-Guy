---
title: OAuth Account Linking
type: architecture
updated: 2026-05-08
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1446
  - src/app/api/oauth/google/callback/route.ts
---

# OAuth Account Linking

## Overview

OAuth Google callback handles email collision scenarios by linking to existing accounts.

## Collision Scenarios

| Scenario | Behavior |
|----------|----------|
| New user | Create account with Google `sub` |
| Existing user with same Google `sub` | Link and authenticate |
| Existing user with same email, no `googleSub` | Link Google account to existing user |
| Existing user with different `googleSub` | Return error |

## The Bug

Email collision lookup missing `overrideAccess: true`:

```typescript
// BROKEN: Fails in anonymous OAuth callback context
const existingUser = await payload.findByID({
  collection: 'users',
  id: userId,
})
```

Payload's access controls run even in admin/API routes when no valid session exists.

## The Fix

```typescript
// CORRECT: Bypass access control
const existingUser = await payload.findByID({
  collection: 'users',
  id: userId,
  overrideAccess: true,
})
```

This mirrors the `googleSub` lookup pattern and enables account linking flow.

## Testing

Integration test `OAuth Callback — Account Linking`:
1. Create user via direct MongoDB (bypassing Payload session)
2. Initiate Google OAuth with matching email
3. Verify lookup returns user, preventing 500 error

## Related

- [oauth-google](./oauth-google.md) (if exists)
