# Spec: 260309-auto-882

## Overview

Fix a high-severity race condition and partial-failure bug in guest → registered account upgrades where `claimGuestConversations()` currently transfers conversations non-atomically, can orphan conversations created during the claim window, and can later cause data loss via the guest session cleanup cron.

The fix introduces an explicit guest-session "claiming" state (lock), ensures the claim flow is idempotent and safe to retry, blocks new guest conversation/message creation while a session is claiming, and updates cleanup logic to avoid deleting in-flight data.

## Requirements

### FR-001: Guest session state machine includes `claiming`

**Priority**: MUST
**Description**: Guest sessions MUST support a `status` state machine that includes at least: `active`, `claiming`, `revoked`.

Details:
- The "claiming" state represents an in-progress upgrade lock.
- **CRITICAL**: The current GuestSessions collection has status options: `active`, `expired`, `revoked`. The `expired` status MUST be deprecated and replaced with the `claiming` state machine. Sessions that were previously marked `expired` should be treated as candidates for cleanup (hard-expired), not as active sessions.
- The system MUST define how any pre-existing statuses (e.g., `expired`) map to the new set without breaking existing behavior.

### FR-002: Claim lock acquisition is atomic and concurrency-safe

**Priority**: MUST
**Description**: Starting a claim MUST acquire a lock via an atomic compare-and-set transition (`active` → `claiming`). Only one claim attempt may hold the lock at a time.

Lock semantics:
- Acquire succeeds only if session is currently `active`.
- Implementation MUST use atomic database operation (e.g., `findOneAndUpdate` with status filter) to prevent race conditions.
- If session is already `claiming`, the implementation MUST either:
  - treat the claim as resumable by the same user (if recorded), or
  - return a retryable "in progress" result.
- If session is `revoked` (or missing/invalid), claim MUST be a no-op success.

### FR-003: Claim flow is idempotent and prevents orphaning

**Priority**: MUST
**Description**: Claiming guest conversations MUST be idempotent and safe to retry after partial failure.

Behavioral requirements:
- The claim operation MUST transfer ownership for all conversations currently associated with the guest session to the authenticated user.
- The claim operation MUST ensure conversations created during the claim window are not permanently orphaned.
- The claim operation MUST NOT revoke/clear the guest session until it can confirm there are zero remaining conversations owned by that guest session.
- On any error after acquiring the lock, the system MUST leave the session in a state that allows safe retries (e.g., remain `claiming` until resumed/completed or timed out).

Transfer semantics:
- Each claimed conversation MUST end with ownership consistent with collection rules (e.g., set `user = <userId>` AND clear `guestSession = null`).

### FR-004: Prevent new guest conversations/messages while `claiming`

**Priority**: MUST
**Description**: While a guest session is `claiming`, the platform MUST prevent creating new guest conversations and writing new guest messages associated with that session.

API/service behavior:
- Guest chat entrypoints (e.g., `getOrCreateGuestConversation()` and any message send path) MUST re-check guest session status before creating/updating resources.
- If `status=claiming`, these entrypoints MUST return a retryable error (recommended: HTTP 409 Conflict or 423 Locked) and MUST NOT create a new guest session as a fallback for that request.

### FR-005: Login/signup upgrade uses authenticated user identity and cookie-sourced guest token

**Priority**: MUST
**Description**: The guest-session claim MUST be bound to the authenticated user and MUST NOT accept arbitrary `userId`/guest token from untrusted inputs.

Constraints:
- The claim entrypoint MUST derive `userId` from the authenticated session (`req.user` / `payload.auth({ headers })`), not from a parameter.
- The guest session identifier/token MUST be sourced from the existing HttpOnly cookie (or equivalent trusted server-side context), not from request body/query.

### FR-006: `revokeGuestSession` supports request context propagation

**Priority**: MUST
**Description**: Session revocation and any nested Payload operations involved in claim/revoke MUST accept and propagate a request context (`req`) when available to support consistent auditing/transactions and align with project conventions.

The claim flow in login/signup actions MUST propagate available request context to:
- `getGuestSessionByToken()`
- `claimGuestConversations()`
- `revokeGuestSession()`

Note: If true multi-document transactions are desired, the spec MUST explicitly require DB support (replica set) across all environments (including tests). Otherwise, idempotency + lock-based correctness is the primary guarantee.

### FR-007: Cleanup cron respects `claiming` and is safety-first

**Priority**: MUST
**Description**: The guest session cleanup cron MUST NOT delete guest sessions (or associated conversations/messages) in `claiming` state and MUST avoid deleting data when ownership is ambiguous.

Required behaviors:
- Exclude `status=claiming` from deletion candidates.
- Only delete `status=revoked` sessions past TTL/grace period.
- Before deleting a revoked session, verify there are zero remaining conversations referencing that session; if not zero, skip deletion and record an error/metric.
- Cleanup MUST handle pagination/limits such that it does not delete the session if it has not fully processed associated data.

### FR-008: Integration tests for race conditions and partial failures

**Priority**: MUST
**Description**: Add integration tests to demonstrate the fix prevents orphaning and is safe under concurrency and partial failures.

Test scenarios:
- Partial failure during claim does not revoke session and is safe to retry; eventual completion results in zero guest-owned conversations.
- Concurrent attempt to create a guest conversation/message while claim is in progress is blocked (returns retryable error) and does not create a new session.
- Successful claim transfers all conversations and revokes session only after completion.
- Cleanup job never deletes `claiming` sessions and never deletes revoked sessions that still have linked conversations.

### NFR-001: No data loss or silent deletion due to upgrade races

**Priority**: MUST
**Description**: The system MUST guarantee that a guest → user upgrade does not result in conversation loss. Specifically, no conversation created by the guest before or during the claim window may become unreachable solely due to upgrade.

### NFR-002: Safe observability without leaking secrets

**Priority**: MUST
**Description**: Logs and metrics MUST NOT include raw guest session tokens/cookies. Where needed, log only stable identifiers (session ID, user ID) with redaction.

### NFR-003: Backward compatibility for users without guest sessions

**Priority**: SHOULD
**Description**: Login/signup flows MUST continue to work when the guest cookie is absent/expired; claim should be treated as a no-op success in these cases.

### NFR-004: Performance and scalability

**Priority**: SHOULD
**Description**: Claiming SHOULD avoid N+1 updates where possible (e.g., prefer bulk update) and MUST be bounded/paginated for users with many conversations.

## Acceptance Criteria

- [ ] Guest session records support `status` with values `active`, `claiming`, `revoked` (and any legacy statuses are handled without breaking existing flows).
- [ ] Claim begins by atomically transitioning the guest session from `active` to `claiming` (compare-and-set); concurrent claims do not interleave.
- [ ] While `status=claiming`, `getOrCreateGuestConversation` and guest message creation reject the request with a retryable error and do not create a new guest session.
- [ ] Claiming is idempotent: repeated calls (including retries after failures) eventually result in all conversations owned by the authenticated user and `guestSession=null` on those conversations.
- [ ] Guest session revocation occurs only after verifying there are zero remaining conversations linked to the guest session.
- [ ] Cleanup cron never deletes sessions in `claiming` and verifies zero remaining conversations before deleting revoked sessions.
- [ ] Integration tests cover: partial failure + retry, concurrent creation during claim window, full successful claim, and cleanup safety.
- [ ] No logging includes raw guest tokens/cookies.

## Guardrails

- Do NOT introduce any path that allows a user to claim another user's guest conversations (no caller-supplied `userId`; no token accepted from body/query).
- Do NOT clear the guest cookie or revoke the guest session on partial failure.
- Do NOT create a new guest session as a fallback response when the existing session is `claiming`.
- Do NOT change conversation ownership semantics beyond the minimum required (must continue to enforce "exactly one owner": user XOR guestSession).
- Cleanup cron must remain conservative: if uncertain (non-zero linked conversations), skip deletion.

## Out of Scope

- UX changes beyond returning a retryable error for guest actions while claiming (no new UI requirements specified).
- Migrating/merging other guest-owned resources (e.g., settings, preferences) unless they are already part of the existing upgrade flow.
- Broader refactors of authentication/session architecture.

## Open Questions

1. **Legacy status handling (RESOLVED)**: The current GuestSessions collection has status options: `active`, `expired`, `revoked`. The `expired` status is set manually but is not used for cleanup - the cleanup cron uses `hardExpiresAt` date field instead. **Resolution**: Deprecate `expired` status, remove from options, use `status=active` + date-based expiry checking.
2. **Transaction strategy (RESOLVED)**: Use lock-based idempotency without transactions per @payload-expert recommendation - Mongo transactions require replica set not available in test environment. **Resolution**: Implement lock-based CAS pattern without transactions.
3. **Blocked operations scope (RESOLVED)**: Block both conversation creation AND message writes during claiming to avoid losing in-flight messages. **Resolution**: Both conversation and message creation blocked per FR-004.
4. **Stuck claiming recovery**: What is the expected behavior if a claim crashes and the session remains `claiming` (lock TTL, reset to `active`, or cleanup after expiry)?
5. **HTTP status contract**: Should "session claiming" return 409 vs 423, and should the frontend auto-retry?

## Domain Expert Feedback

### @payload-expert
- Warned that Mongo transactions require a replica set; current test Mongo setup may not support transactions. Recommended a lock-based, idempotent workflow (`active→claiming` then bulk claim then `claiming→revoked`) that remains correct without transactions.
- Noted GuestSessions may already have statuses such as `expired`; spec must address compatibility.
- Highlighted Conversations ownership constraint: claiming must set `user` and clear `guestSession` to avoid invalid dual ownership.

### @security-auditor
- Required guardrails: claim must derive `userId` from authenticated context; guest token must come from HttpOnly cookie; no endpoint should accept arbitrary `userId` or token in body/query.
- Emphasized real lock/CAS with timeout to avoid double-claim and "stuck claiming".
- Cleanup must be safety-first: never delete `claiming`; verify zero linked conversations before deleting revoked sessions; avoid pagination pitfalls.

### @web-expert
- Server Actions don't receive a `NextRequest`; any cookie/header context needed for claiming must be gathered inside the action and forwarded, or the action should call an internal Route Handler that can manage headers and multiple `Set-Cookie` values correctly.
- Claim should be idempotent to handle multi-tab login/signup and retries.
