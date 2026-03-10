# Task

## Issue Title

Bug: Non-atomic guest session claim causes orphaned conversations and data loss
# 🐞 Bug Report

## 1. Title
Non-atomic guest session claim leaves orphaned or duplicated conversations during login/signup

## 2. Environment
- Environment: prod & dev
- Browser / Device: Any (race condition, backend-only)
- User Role / Tenant: Guest users upgrading to registered accounts

## 3. Preconditions
- A guest user has an active session with one or more conversations
- The guest user initiates login or signup to convert to a registered account

## 4. Steps to Reproduce
1. Open the platform as a guest user
2. Start a chat conversation (creates a guest session + guest conversation)
3. Open a second browser tab, start another chat conversation
4. In tab 1, click "Sign Up" or "Login" to convert to a registered account
5. While the signup/login is processing, quickly send a message in tab 2 (creating a new conversation during the claim window)
6. After login completes, check the user's conversations

## 5. Expected Result
- ALL guest conversations are transferred to the new user account atomically
- No conversations are lost or orphaned
- Any conversation created during the claim window is also transferred
- The guest session is fully revoked only after all conversations are claimed

## 6. Actual Result
- `claimGuestConversations()` iterates conversations one-by-one without transaction safety
- If any single conversation update fails midway, some conversations are claimed while others remain orphaned under the old guest session
- The guest session is NOT revoked on partial failure, leaving the system in an inconsistent state
- A concurrent chat request during the claim window can create a NEW conversation that is permanently orphaned (owned by a revoked guest session, never claimed)
- The cron cleanup job (`guest-sessions-cleanup.ts`) will eventually delete the orphaned data, destroying user conversations

## 7. Root Cause Analysis

### 7.1 TOCTOU in `claimGuestConversations` (`src/server/services/guest-session-upgrade.ts`, lines 31-79)

The function claims to be atomic (per doc header: "Atomic transaction: all convs transfer or none (S7)") but is NOT:

```typescript
// 1. Find all guest conversations
const guestConvs = await payload.find({ collection: 'conversations', ... })

// 2. Iterate one-by-one (NOT atomic)
for (const conv of guestConvs.docs) {
  await payload.update({ collection: 'conversations', id: conv.id, ... })
  // If this throws on iteration 3 of 5, conversations 1-2 are claimed,
  // 3-5 are orphaned. No rollback.
}

// 3. Revoke session (never reached on partial failure)
await revokeGuestSession(payload, sessionId)
```

### 7.2 Missing `req` passing (transaction safety violation)

None of the Payload operations in `claimGuestConversations` pass `req`, so they all run in separate transactions. This violates the documented rule in AGENTS.md: "ALWAYS pass `req` to nested operations in hooks."

### 7.3 Race window for new conversations

Between the `find` query (step 1) and `revokeGuestSession` (step 3), the guest session is still valid. A concurrent request can create a new conversation via `getOrCreateGuestConversation()` that will never be claimed.

## 8. Files Affected

- `src/server/services/guest-session-upgrade.ts` - the non-atomic claim function (primary fix)
- `src/server/services/guest-session.ts` - `revokeGuestSession` does not accept/pass `req`
- `src/server/services/conversation-service.ts` - `getOrCreateGuestConversation` can create during race window
- `src/app/(frontend)/login/login_authenticate-action.ts` - caller during login (needs to pass request context)
- `src/app/(frontend)/signup/actions/signup_createUser-action.ts` - caller during signup (needs to pass request context)
- `src/server/payload/endpoints/cron/guest-sessions-cleanup.ts` - cleanup job may delete orphaned data

## 9. Expected Fix

1. Pass `req` to all nested Payload operations in `claimGuestConversations` for transaction atomicity
2. Mark session as "claiming" before iteration to prevent new conversation creation during the window
3. Implement proper rollback - if any conversation update fails, revert already-claimed conversations
4. Update `getOrCreateGuestConversation` to reject new conversations when session is in "claiming" state
5. Update `revokeGuestSession` to accept and pass `req` parameter
6. Add integration tests that verify:
   - All-or-nothing claim behavior under partial failure
   - No orphaned conversations after successful claim
   - Concurrent conversation creation during claim window is handled

## 10. Severity
**High** - data loss affecting real users who sign up after using guest chat

## 11. Reproducibility
**Always** under concurrent conditions; **intermittent** under normal single-tab usage (depends on timing)
