# Spec: Anonymous Chat via Expiring GuestSessions

## 1) Goals
- Allow unregistered (anonymous) visitors to use the existing chat experience.
- Persist anonymous conversations across page reloads and short return visits.
- Provide a clear upgrade path: when a guest registers/logs in, their guest conversations become owned by the user.
- Enforce predictable lifetime and storage limits for guest data.
- Keep Payload as the system of record (conversations/messages remain in Payload).

## 2) Non-Goals
- Cross-device guest continuity (no accounts, no email links).
- Long-term memory for guests beyond the GuestSession lifetime.
- Anonymous user profile, progress tracking, or other non-chat persistence.
- Anti-bot guarantees (we will add basic abuse controls, not full bot mitigation).

## 3) Glossary
- Guest: An unregistered visitor without a Users account.
- GuestSession: A server-issued, expiring session used to associate guest conversations.
- Session token: Opaque random value stored in an HttpOnly cookie and validated server-side.
- Conversation ownership: The principal that is allowed to read/write a conversation (User or GuestSession).
- Sliding TTL: Expiration window extended on activity.
- Hard cap: Absolute maximum lifetime since creation, regardless of activity.

## 4) Current State (as-is)
- Conversations are owned by an authenticated user (e.g. `conversations.user`).
- Chat endpoints assume a logged-in user.
- Retention and cleanup are driven by existing conversation/message lifecycle (no guest scope).

## 5) Target Architecture (to-be)
### 5.1 Core Components
1) GuestSessions collection
- Stores minimal session metadata and expiry state.
- Does not store chat content; chat content remains in Conversations.

2) Conversation ownership abstraction
- Conversations are owned by exactly one principal:
  - authenticated User, or
  - GuestSession.
- Authorization checks use ownership to gate reads/writes.

3) Session token cookie
- HttpOnly cookie holds an opaque guest session token.
- Server maps token -> GuestSession (token is stored hashed in Payload).

4) Payload-side scheduled cleanup job
- Periodically deletes expired GuestSessions and their associated guest-owned conversations.
- Enforces storage limits and removes abandoned data.

### 5.2 High-Level Invariants
- A guest can only access conversations tied to their active GuestSession token.
- A user can only access conversations tied to their user account.
- A conversation cannot be owned by both a guest and a user at the same time.
- Upgrading (guest -> user) is an ownership transfer, not a data copy.

## 6) Data Models

### 6.1 GuestSession (new)
High-level fields (names illustrative; exact Payload field types/indices defined during implementation):

```ts
GuestSession {
  id: string

  // Auth
  tokenHash: string              // hash(token); unique index
  tokenVersion: number           // allows rotation/invalidation

  // Lifetime
  createdAt: string              // timestamps
  lastActiveAt: string           // updated on successful chat activity
  expiresAt: string              // computed (sliding TTL, clamped by hard cap)
  hardExpiresAt: string          // createdAt + hard cap

  // Abuse control / observability (minimal)
  ipHash?: string                // optional; hash of IP (privacy-preserving)
  userAgentHash?: string         // optional; hash of UA
  status: 'active' | 'expired' | 'revoked'

  // Optional: link after upgrade for audit/debug
  claimedByUser?: string         // relationship to Users or scalar userId
  claimedAt?: string
}
```

Notes:
- tokenHash is stored (never store the raw token in Payload).
- ipHash/userAgentHash are optional and should be treated as abuse-control signals, not identity.

### 6.2 Conversation Ownership (change)
Current model uses a user-owned conversation. To support guests:

Option A (recommended): polymorphic owner relationship

```ts
Conversation {
  id: string
  owner: { relationTo: 'users' | 'guest-sessions', value: string }
  // existing fields: exercise, messages[], summary, lastMessageAt, ...
}
```

Option B: explicit fields

```ts
Conversation {
  id: string
  user?: string                  // relationship to Users
  guestSession?: string          // relationship to GuestSessions
}
```

Ownership rule:
- Exactly one of (user, guestSession) is set.

### 6.3 Ownership Transfer on Upgrade
When a guest registers/logs in and claims their guest data:
- Conversation ownership changes from GuestSession -> User.
- GuestSession is marked claimed (and may be revoked immediately or allowed to expire naturally).

## 7) Request Flows

### 7.1 Anonymous Chat (new)
1) Client calls chat endpoint without an authenticated session.
2) Server checks for `guest_session` cookie.
3) If missing or invalid:
   - Create GuestSession (status=active).
   - Issue a new random token and set HttpOnly cookie.
4) Authorize request using the GuestSession.
5) Find or create a guest-owned Conversation (scoped to exercise/context as today).
6) Append user message, run the existing model workflow, append assistant response.
7) Update GuestSession activity:
   - lastActiveAt = now
   - expiresAt = min(now + slidingTTL, hardExpiresAt)
8) Return response.

Behavior when expired:
- If token maps to an expired/revoked GuestSession, treat as no session and start a new GuestSession.
- Guest-owned conversations from the expired session become inaccessible (and will be deleted by cleanup).

### 7.2 Authenticated User Chat (existing)
1) Client calls chat endpoint with authenticated session.
2) Server authorizes using user identity.
3) Find or create a user-owned Conversation.
4) Proceed with existing chat + memory/context pipeline.

Guest cookie interaction:
- If a guest cookie is present while authenticated, the server does not read guest conversations by default.
- The upgrade flow (7.3) is the explicit mechanism to attach guest conversations to the user.

### 7.3 Upgrade on Registration / Login (new)
Trigger points:
- After successful registration.
- After successful login (if a guest cookie exists).

Flow:
1) Server validates user authentication.
2) Server checks for a valid active GuestSession token.
3) Server queries Conversations owned by that GuestSession.
4) Transfer ownership:
   - For each guest-owned Conversation, set owner to the authenticated user.
   - Preserve conversation IDs and message history.
5) Mark GuestSession as claimed:
   - claimedByUser, claimedAt
   - status = revoked (recommended) OR allow to expire naturally
6) Clear guest cookie (recommended) to avoid ambiguity.

Conflict handling (high-level):
- If the user already has a Conversation for the same exercise/context, do not merge messages automatically.
- Keep both conversations; UI may later offer a merge UX (out of scope).

## 8) Expiry Semantics

### 8.1 Parameters
- slidingTTL: e.g. 7 days since lastActiveAt (configurable).
- hardCap: e.g. 30 days since createdAt (configurable).

### 8.2 Computation
- hardExpiresAt = createdAt + hardCap
- expiresAt = min(lastActiveAt + slidingTTL, hardExpiresAt)

### 8.3 What Extends the Sliding TTL
- Successful chat write activity (user message accepted and persisted).
- Optional: read-only access does not extend TTL (recommended) to reduce abuse.

### 8.4 Expiration Effects
- Once now > expiresAt, the GuestSession is expired.
- Expired sessions cannot authorize chat reads/writes.
- Conversations owned by an expired GuestSession remain in DB until cleanup deletes them.

## 9) Cleanup Mechanism (Payload-side Scheduled Job)

### 9.1 Responsibilities
- Delete expired GuestSessions.
- Delete conversations owned by expired GuestSessions (cascades message history).
- Enforce per-session quotas (optional) by trimming or deleting oldest conversations.

### 9.2 Scheduling
- Run on a fixed interval (e.g. every 1 hour).
- Implemented server-side (Payload process), not client-driven.

### 9.3 Idempotency and Safety
- Job is safe to run concurrently (idempotent deletes / conditional updates).
- Uses server-side privileged access, with strict filters to only touch GuestSession-owned data.

### 9.4 Observability
- Emit structured logs for:
  - number of sessions expired/deleted
  - number of conversations deleted
  - runtime and error counts

## 10) Abuse Controls and Limits

### 10.1 Rate Limiting (recommended)
- Limit chat requests per IP and per GuestSession token.
- Apply stricter limits to anonymous requests than authenticated requests.
- Return 429 on limit exceeded.

### 10.2 Storage Limits
- Max conversations per GuestSession (e.g. 5).
- Max messages per guest-owned conversation (e.g. aligned with current maxRows; keep conservative).
- Max message size (characters) and max request payload size.

### 10.3 Session Creation Controls
- Max new GuestSessions per IP per time window.
- Optional: require a lightweight challenge (captcha) only if abuse signals trip (out of scope for initial rollout).

### 10.4 Content Safety
- Apply existing content moderation/safety checks to guest messages.
- Do not allow guests to access admin-only or user-only endpoints.

## 11) Privacy and Retention

### 11.1 Data Minimization
- GuestSession stores only what is needed to authorize and expire the session.
- Avoid storing raw IP or full User-Agent; use hashes if needed for abuse control.

### 11.2 Retention
- Guest conversations are retained only until GuestSession expiry + cleanup.
- Do not include guest data in long-term memory systems beyond the guest lifetime.

### 11.3 Upgrade Effects
- After ownership transfer, the conversation becomes subject to the user's normal retention rules.
- GuestSession record can be deleted immediately after claim, or retained briefly for audit (configurable).

### 11.4 User Rights
- Authenticated users can delete their conversations via existing mechanisms.
- Guests have no identity-based recovery; deleting cookies effectively drops access.

## 12) Security Considerations

### 12.1 Token Handling
- Generate cryptographically strong random tokens.
- Store only tokenHash in Payload.
- Cookie properties: HttpOnly, Secure (in production), SameSite=Lax (or Strict if compatible), Path=/.
- Rotate or revoke tokens on claim/upgrade.

### 12.2 Authorization Rules
- Every conversation read/write requires verifying ownership (User or GuestSession).
- Prevent IDOR: never allow fetching a conversation by ID without verifying ownership.

### 12.3 Account Takeover and Session Hijacking
- Guest tokens are bearer tokens; protect them like sessions.
- Do not expose tokens to JS (HttpOnly) to reduce XSS impact.
- Consider short sliding TTL defaults to limit the blast radius.

## 13) Migration

### 13.1 Schema Migration
- Add GuestSessions collection.
- Update Conversations to support ownership by GuestSession.
- Add required indexes (tokenHash, ownership fields, expiresAt).

### 13.2 Data Migration
- Existing user-owned conversations remain unchanged.
- No backfill required unless the current schema requires introducing a new owner field.

### 13.3 Compatibility
- Existing authenticated chat flows continue to work unchanged.
- Anonymous chat is additive and can be gated behind a feature flag.

## 14) Rollout Plan

### Phase 1: Foundations (behind flag)
- Introduce GuestSessions model and ownership abstraction.
- Implement guest authorization and basic expiry semantics.
- Add cleanup job (dry-run mode first, logs only).

### Phase 2: Enable Anonymous Chat
- Turn on anonymous chat in the frontend.
- Monitor: guest session creation rate, error rate, abuse signals, cleanup metrics.

### Phase 3: Upgrade Path
- Enable claim-on-register and claim-on-login behavior.
- Validate ownership transfer correctness and conflict behavior.

### Phase 4: Tighten Controls
- Tune rate limits and storage limits.
- Enable destructive cleanup (delete expired sessions/conversations) if not already enabled.

### Phase 5: Documentation and Support
- Document user-facing behavior (guest expiry, what happens on login).
- Add operational runbook for cleanup job and incident response.
