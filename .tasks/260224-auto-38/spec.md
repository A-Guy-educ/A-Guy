# Spec: 260224-auto-38

## Overview

Fix transaction-safety bug in `ConversationService` by ensuring every Payload Local API operation (`find`, `findByID`, `create`, `update`, `delete`, etc.) is executed with the caller's `req`/`PayloadRequest`, so operations participate in the same transaction and request context. The highest-risk path is `resetConversation` (archive + create), which must be atomic.

## Requirements

### FR-001: Propagate request context into ConversationService

**Priority**: MUST  
**Description**: Refactor `ConversationService` so it accepts a `req`/`PayloadRequest` context (either via method parameters or by constructing the service with a per-request `req`) and can pass that `req` to all Payload operations.

### FR-002: Add `req` to every Payload operation inside ConversationService

**Priority**: MUST  
**Description**: Update all Payload calls within `src/server/services/conversation-service.ts` (approximately 21 operations across all methods including `buildContextHierarchy`) to include the `req` option so they execute within the caller's transaction/request context. This includes all `find`, `findByID`, `create`, and `update` operations.

### FR-003: Ensure `resetConversation` is atomic

**Priority**: MUST  
**Description**: `resetConversation` must perform its multi-step workflow (e.g., archive existing conversation + create new conversation and any related writes) using the same `req` so it can be committed/rolled back as one unit.

### FR-004: Include `buildContextHierarchy` in req propagation

**Priority**: MUST  
**Description**: The standalone `buildContextHierarchy` function must also accept a `req` parameter for use cases where it is called from within a request context, ensuring consistent transaction behavior.

### NFR-001: Preserve existing functional behavior

**Priority**: MUST  
**Description**: Aside from adding request propagation, do not change query filters, sorting, pagination, selected fields, or returned data shapes. The service's business logic and results should remain equivalent.

### NFR-002: Preserve existing access-control semantics

**Priority**: MUST  
**Description**: Do not inadvertently broaden or restrict permissions. Adding `req` must not introduce new `overrideAccess` behavior changes unless explicitly required and documented.

### NFR-003: Type-safety and clarity

**Priority**: SHOULD  
**Description**: Use the appropriate Payload types (`PayloadRequest` or equivalent) so callers have a clear contract for providing request context.

## Acceptance Criteria

- [ ] `ConversationService` exposes a clear API that receives a `req`/`PayloadRequest` context (per-method or per-instance).
- [ ] Every Payload operation in `src/server/services/conversation-service.ts` includes `req` in its options.
- [ ] `resetConversation` executes all its writes using the same `req` (no mixed contexts), enabling atomic behavior.
- [ ] `buildContextHierarchy` accepts optional `req` parameter for transaction-safe operation when called from request context.
- [ ] No observable changes in business logic, query behavior, or response shapes other than those caused by operating inside the caller's transaction.
- [ ] No new collections/endpoints are introduced; the change is scoped to the service.

## Guardrails

- Limit implementation scope to `src/server/services/conversation-service.ts` as identified in the task.
- Do not alter unrelated services or infrastructure.
- Do not change data model/schema.
- Do not change access control intent (no new bypasses, no new restrictions) as part of this fix.

## Out of Scope

- Adding/altering access control rules across collections.
- Introducing new transaction management utilities beyond passing `req` to existing operations.
- Refactoring unrelated service architecture or converting other services to a different dependency-injection pattern.
- Adding new tests (recommended, but not required by this task spec unless the execution pipeline mandates them).

## Open Questions

1. Should `ConversationService` be instantiated per request (constructor takes `PayloadRequest` and uses `req.payload`), or should each method accept `req` as a parameter? (Both satisfy the requirement; choose the option that best matches existing call sites.)
2. Are there any call sites that use `ConversationService` outside an HTTP request context (e.g., cron/background jobs)? If yes, what `req` should be used (synthetic req, or allow an optional `req` with documented non-transactional behavior)?
3. Does the project intentionally rely on Local API access-control bypass in this service today? If not, should this work item also require `overrideAccess: false` when a user context is involved? (Not requested in the task; clarify before changing access semantics.)

## Domain-Specific Validation

This change touches Payload CMS Local API usage and transaction safety patterns.

- @payload-expert review is recommended to confirm the proposed `req` propagation approach matches Payload 3.x best practices (transactions + request context). The existing pattern in `src/server/repos/mcp/audit/audit-service.ts` shows the recommended approach: accept `req: PayloadRequest` as a parameter and pass `req` to Local API operations.
  **Note**: In this spec-only pipeline, no additional repository reads or implementation verification are performed.
