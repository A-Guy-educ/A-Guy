# Spec: 260305-auto-782

## Overview

Refactor chat-related API endpoints to share a single authentication + guest-session resolution flow, eliminating duplicated logic and fixing three security/behavior bugs: (1) rate-limit bypass on `POST /api/agent/reset-chat`, (2) `conversations/by-context` GET/POST Local API access-control bypass due to missing `overrideAccess: false`, and (3) inconsistent guest message-limit enforcement between `chat` and `chat-stream`.

## Requirements

### FR-001: Shared auth/guest resolution middleware

**Priority**: MUST  
**Description**: Implement a shared server-only resolver (referred to as `resolveAuthOrGuest`) that centralizes:

1) Authentication via Payload (`payload.auth({ headers })`) and/or `req.user` when present.  
2) Guest session resolution from cookies/headers (existing guest token) and optional guest session creation when allowed by endpoint policy.  
3) Optional enforcement hooks for rate limiting and guest message limits, controlled by endpoint-specific options.

The resolver MUST return a discriminated union result that clearly distinguishes authenticated users vs guests and provides any `Set-Cookie` headers required when a guest session is created/rotated.

### FR-002: Do not treat guests as Payload users

**Priority**: MUST  
**Description**: Guest identity MUST NOT be represented as a pseudo-`user` object and MUST NOT be assigned to `req.user`. Any downstream Payload Local API calls that include a `user` option MUST only do so for real authenticated `users` collection users.

### FR-003: Refactor endpoints to use the shared resolver

**Priority**: MUST  
**Description**: Replace duplicated auth/guest boilerplate with the shared resolver in all listed files:

1) **NEW** `src/server/payload/endpoints/agent/auth-middleware.ts` (or equivalent path specified by the task)  
2) `src/server/payload/endpoints/agent/chat.ts`  
3) `src/server/payload/endpoints/agent/chat-stream.ts`  
4) `src/server/payload/endpoints/agent/get-conversation.ts`  
5) `src/server/payload/endpoints/agent/reset-chat.ts`  
6) `src/app/api/agent/message/persist/route.ts`  
7) `src/app/api/conversations/by-context/route.ts`

Refactor MUST preserve existing endpoint routes, HTTP methods, and response shapes unless explicitly required for security fixes.

### FR-004: Fix rate-limit bypass on reset-chat

**Priority**: MUST  
**Description**: `POST /api/agent/reset-chat` MUST enforce rate limiting when creating a new guest session (same protection level as `chat` and `chat-stream`). The rate-limit decision MUST occur before creating the guest session record and before setting cookies.

### FR-005: Fix conversations/by-context access-control bypass

**Priority**: MUST  
**Description**: In `src/app/api/conversations/by-context/route.ts`, the GET and POST handlers MUST pass the authenticated user to Payload Local API operations AND MUST set `overrideAccess: false` so the `conversations` collection access control (e.g., `isOwner`) is enforced.

### FR-006: Make guest message-limit enforcement consistent

**Priority**: MUST  
**Description**: Guest message-limit enforcement (e.g., `checkAndIncrementGuestMessageCount`) MUST be applied consistently for guest sessions across `chat.ts` and `chat-stream.ts`, including the first message of a newly-created guest session.

If the system increments guest message count, it MUST do so in a consistent location in the request lifecycle for both endpoints.

### FR-007: Cookie propagation for guest session creation/rotation

**Priority**: MUST  
**Description**: When the resolver creates (or rotates) a guest session, callers MUST forward all `Set-Cookie` headers returned by the resolver to the HTTP response (including endpoints returning SSE/stream responses).

### FR-008: Resolver caching and reuse within a request

**Priority**: SHOULD  
**Description**: The resolver SHOULD cache its result on `req.context` (when a `PayloadRequest` is available) to prevent duplicate authentication/guest lookups during a single request.

### NFR-001: Enforce Payload Local API access control rules

**Priority**: MUST  
**Description**: Any Payload Local API call that passes `user` MUST also pass `overrideAccess: false`. Absence of `overrideAccess` in such calls is considered a defect.

**Guest nuance**: Guest flows MUST NOT rely on Payload collection access controls (which typically key off `req.user`). If guest access to `conversations` is required, it MUST be enforced by explicit query constraints (e.g., filters tied to `guestSessionId`) and carefully-scoped uses of `overrideAccess: true` only where necessary.

### NFR-002: Security-safe error handling

**Priority**: MUST  
**Description**: Shared resolver and refactored endpoints MUST not leak sensitive information in error responses (no stack traces, no raw provider errors, no cookie/token values). Error status codes and messages should remain consistent with existing behavior unless a change is required to close an information disclosure vector.

### NFR-003: Maintainability

**Priority**: MUST  
**Description**: Endpoint-specific policy (e.g., whether guest creation is allowed, whether rate limiting is required, whether message limit checks apply) MUST be expressed via explicit options passed to the resolver rather than ad-hoc per-endpoint logic.

### NFR-004: Test stability

**Priority**: MUST  
**Description**: Existing automated tests MUST continue to pass. Where coverage exists for these endpoints, tests MUST be updated to reflect the refactor without weakening security assertions.

## Acceptance Criteria

- [ ] A shared `resolveAuthOrGuest()` resolver exists at `src/server/payload/endpoints/agent/auth-middleware.ts` (or the final agreed path) and is used by all listed endpoints/routes.
- [ ] `reset-chat` enforces rate limiting when creating a guest session; creating unlimited guest sessions via repeated `POST /api/agent/reset-chat` is no longer possible.
- [ ] `chat` and `chat-stream` enforce guest message limits consistently, including for the first message of newly-created guest sessions.
- [ ] `src/app/api/conversations/by-context/route.ts` GET and POST pass `user` and set `overrideAccess: false` on Payload Local API calls.
- [ ] The resolver never represents a guest as a Payload `user` and never assigns guest identity to `req.user`.
- [ ] Any Local API call passing `user` explicitly sets `overrideAccess: false`; any required `overrideAccess: true` usage is narrowly scoped, justified, and protected by ownership query constraints.
- [ ] **NEW** Authenticated users in `chat.ts` and `chat-stream.ts` use `overrideAccess: false` (not `overrideAccess: true`) when calling Payload Local API - authenticated users must go through collection access control.
- [ ] Guest session cookies created/rotated by the resolver are correctly returned to clients (all `Set-Cookie` headers propagated), including streaming responses.
- [ ] Existing tests continue to pass (and any added/updated tests cover the three fixed bugs).

## Guardrails

- Do NOT change public route paths, HTTP methods, or response payload shapes for the refactored endpoints unless required to fix a documented security bug.
- Do NOT introduce new authentication modes (e.g., treating guests as authenticated users) or broaden access to `conversations` data.
- Do NOT weaken rate limiting or guest message limits; the refactor must at least preserve current protections and close known bypasses.
- **NEW** Authenticated user flows MUST use `overrideAccess: false` - only use `overrideAccess: true` for guest sessions with explicit ownership filters (e.g., `guestSession: { equals: ... }`).
- Keep all logic server-only (no Edge runtime assumptions) and avoid sharing secrets/tokens in logs.

## Out of Scope

- Replacing the underlying rate-limit storage/algorithm (e.g., migrating from in-memory to Redis) unless `checkRateLimit()` is proven inadequate for multi-instance deployments.
- Changing `conversations` collection schema or its access control functions beyond what is needed to ensure `overrideAccess: false` is respected.
- Broad refactors of unrelated endpoints beyond the 7 files listed.

## Open Questions

1) Does `checkRateLimit()` use a multi-instance/shared store (Redis/Upstash/etc.) or in-memory process state? If in-memory, what deployment environments are supported and is that acceptable for the threat model?
2) For guests, is the guest token intended to be bound to the original `ipHash`/`userAgentHash` on subsequent requests (verification on use), or are these stored only for analytics? The resolver should codify the intended policy.
3) When a request has both an authenticated user session and an existing guest cookie, what is the precedence policy (ignore guest, migrate/claim guest conversation, or clear guest cookie)?
4) Are there additional chat-related endpoints beyond the listed files that should adopt the resolver to avoid reintroducing duplication/security drift?
