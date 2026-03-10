# GSD Research Report

Task: Fix race condition and partial failure bugs in guest → registered account upgrades

## Codebase Analysis

### Current Guest Session State Machine

**GuestSessions Collection** (`src/server/payload/collections/GuestSessions.ts`):
- Current status options: `'active' | 'expired' | 'revoked'`
- **Critical finding**: The `'expired'` status exists but is NOT used by cleanup logic
- Cleanup uses `hardExpiresAt` date field instead of status for expiry determination
- Sessions marked as `'revoked'` indicate they were claimed by users

### Current Upgrade Flow (Race Condition Vulnerable)

**claimGuestConversations** (`src/server/services/guest-session-upgrade.ts`):
1. Finds guest session by token (no locking)
2. Queries conversations with `guestSession = sessionId` 
3. **RACE CONDITION**: Updates conversations one-by-one in loop (lines 59-70)
4. Revokes session after conversation transfer (line 72)
5. Clears cookie (line 74)

**Critical Issues Identified**:
- No atomic lock acquisition before claiming starts
- Conversations created during claim window can be orphaned
- Partial failures leave session in inconsistent state
- No protection against concurrent claims

### Guest Conversation Creation Points

**Primary Creation Path** (`src/server/services/conversation-service.ts:getOrCreateGuestConversation`):
- Creates guest conversations via `ConversationService`
- Enforces guest conversation limits
- **Issue**: No guest session status validation before creation

**API Endpoints with Guest Support**:
1. **get-conversation.ts** - Fetches existing conversations for guests
2. **message/persist/route.ts** - Persists messages to guest conversations
3. **conversations/by-context/route.ts** - Only supports authenticated users (no guest mode)

**Message Creation Points**:
- Guest messages persisted via `/api/agent/message/persist` endpoint
- No guest session status validation before message creation

### Cleanup Logic Analysis

**Current Cleanup** (`src/server/payload/endpoints/cron/guest-sessions-cleanup.ts`):
- Finds sessions where: `status = 'revoked'` OR `hardExpiresAt < now`
- **Issue**: No handling of proposed `'claiming'` status
- Deletes conversations then sessions (correct order)
- **Safety**: Already verifies conversations before session deletion

### Access Control Patterns

**Conversations Collection** (`src/server/payload/collections/Conversations.ts`):
- Supports dual ownership: `user` XOR `guestSession` (enforced by beforeChange hook)
- **Constraint**: Exactly one owner required, not both
- Archive pattern: `archivedAt` field presence indicates archived state

### Integration Points

**Login Action** (`src/app/(frontend)/login/login_authenticate-action.ts:77-90`):
- Calls `claimGuestConversations` after successful authentication
- Gets guest token from cookie
- **Issue**: No retry logic if claim fails

**Signup Action** (`src/app/(frontend)/signup/actions/signup_createUser-action.ts:98-110`):
- Same pattern as login action
- Vulnerable to same race conditions

## Files to Modify

### Core Service Files
1. **src/server/payload/collections/GuestSessions.ts**
   - Add `'claiming'` status option
   - Update admin interface to show claiming state
   - Remove `'expired'` from options (deprecated)

2. **src/server/services/guest-session-upgrade.ts**
   - Implement atomic lock acquisition (CAS operation)
   - Add idempotency and retry safety
   - Improve error handling and partial failure recovery

3. **src/server/services/guest-session.ts**
   - Add `acquireClaimLock()` function with atomic CAS
   - Update `getGuestSessionByToken()` to handle claiming status
   - Add request context propagation to existing functions

4. **src/server/services/conversation-service.ts**
   - Add guest session status validation in `getOrCreateGuestConversation`
   - Block creation when status = `'claiming'`
   - Return retryable error (409/423) instead of creating new session

### API Endpoints
5. **src/app/api/agent/message/persist/route.ts**
   - Add guest session status check before message creation
   - Return retryable error if session is claiming

### Cleanup Logic
6. **src/server/payload/endpoints/cron/guest-sessions-cleanup.ts**
   - Exclude `status = 'claiming'` from deletion candidates
   - Update session discovery query to handle new status
   - Add safety checks for claiming sessions

### Integration Points
7. **src/app/(frontend)/login/login_authenticate-action.ts**
   - Add request context propagation
   - Improve error handling for claim failures

8. **src/app/(frontend)/signup/actions/signup_createUser-action.ts**
   - Same improvements as login action

## Dependencies

### Database Requirements
- **MongoDB Comparison**: `findOneAndUpdate` with filter for atomic CAS
- **No Transactions Required**: Lock-based approach avoids transaction dependency
- **Index Performance**: Existing indexes on `tokenHash` and `status` sufficient

### Service Dependencies
- **Guest Session Service**: Core dependency for lock acquisition
- **Conversation Service**: Needs status validation integration
- **Logger**: Required for observability without leaking tokens

### Cross-Service Impact
- **Authentication Flow**: Login/signup actions depend on upgraded service
- **Chat System**: All guest conversation creation must validate session status
- **Cleanup Jobs**: Must respect new claiming state

## Technical Constraints

### Payload CMS Patterns
- **Access Control**: Must maintain `user` XOR `guestSession` ownership constraint
- **Request Context**: All Payload operations should propagate `req` when available
- **Field Validation**: Cannot use nested objects (Payload limitation)

### Concurrency Challenges
- **Race Window**: Multiple login attempts with same guest session
- **Partial Failures**: Network/DB failures during claim process
- **Session Cookie**: Server Actions don't receive NextRequest (header access limited)

### Backward Compatibility
- **Expired Status**: Must handle existing sessions with `'expired'` status
- **API Contracts**: Existing endpoints should not break
- **Database Migration**: Graceful handling of status field changes

### Performance Requirements
- **Bulk Operations**: Use bulk updates for conversation transfers (avoid N+1)
- **Pagination**: Handle large conversation counts in claim process
- **Lock Timeouts**: Implement reasonable timeouts to avoid stuck sessions

## Recommendations

### Implementation Strategy

1. **Phase 1: Status Machine Update**
   - Add `'claiming'` status to GuestSessions
   - Update cleanup to handle new status
   - Maintain backward compatibility with `'expired'`

2. **Phase 2: Atomic Lock Implementation**
   - Implement `acquireClaimLock()` with CAS operation
   - Add idempotent claim flow with retry safety
   - Update upgrade service with atomic operations

3. **Phase 3: Blocking Integration**
   - Add status validation to conversation/message creation
   - Return appropriate HTTP status codes (409/423)
   - Update all guest-facing endpoints

4. **Phase 4: Integration & Testing**
   - Update login/signup actions
   - Add comprehensive integration tests
   - Verify race condition fixes

### Error Handling Strategy

**Retryable Errors**:
- HTTP 409 Conflict: Guest session is claiming (client should retry)
- HTTP 423 Locked: Alternative status for claiming state

**Non-Retryable Errors**:
- HTTP 401: Session expired/invalid
- HTTP 400: Malformed request

**Partial Failure Recovery**:
- Leave session in `'claiming'` state for retry
- Implement claim resume logic for same user
- Add timeout mechanism to reset stuck sessions

### Security Considerations

**Authentication Binding**:
- Derive `userId` from authenticated session only
- Never accept user ID from request parameters
- Source guest token from HttpOnly cookie only

**Token Protection**:
- Log session IDs, never raw tokens
- Use stable identifiers for monitoring
- Maintain existing token hashing patterns

**Access Control**:
- Maintain existing ownership constraints
- Preserve field-level access controls
- Ensure overrideAccess usage follows project patterns

### Testing Requirements

**Integration Test Scenarios**:
1. **Concurrent Claims**: Multiple login attempts with same guest session
2. **Partial Failures**: Network interruption during claim process
3. **Blocked Operations**: Conversation/message creation during claiming
4. **Cleanup Safety**: Verify claiming sessions are not deleted
5. **Idempotency**: Retry claims result in consistent final state

**Performance Tests**:
- Large conversation counts (pagination handling)
- High concurrency scenarios
- Lock acquisition under load

This analysis provides the foundation for implementing a robust, race-condition-free guest session upgrade system that maintains backward compatibility while ensuring data integrity.
