# Plan: 260224-auto-38 — Fix Transaction-Safety Bug in ConversationService

## Summary

The `ConversationService` in `src/server/services/conversation-service.ts` performs ~21 Payload Local API operations (`find`, `findByID`, `create`, `update`) **without passing `req`** (the `PayloadRequest` object). This means operations run outside the caller's transaction/request context, breaking atomicity — especially in `resetConversation` where an archive + create must be atomic.

**Root Cause**: Every Payload operation in `ConversationService` uses `this.payload.<operation>(...)` without the `req` option. Per Payload 3.x best practices (documented in AGENTS.md), all nested operations MUST pass `req` to maintain transaction safety.

**Fix Strategy**: Use the **per-method `req` parameter** approach (not per-instance constructor), because:
1. Call sites already have `req` available (they destructure `req.payload`)  
2. The `buildContextHierarchy` standalone function has no instance — it needs a parameter approach anyway
3. Making `req` optional preserves backward compatibility for call sites without request context

## Assumptions

- `clarified.md` and `rerun-feedback.md` were not found — this is a first run
- The per-method parameter approach is preferred over constructor injection because it keeps the change scoped to `conversation-service.ts` and avoids touching unrelated endpoints/infrastructure.
- Access control semantics are NOT changed: we pass `req` for transaction safety only, NOT adding/removing `overrideAccess` (per NFR-002)
- The `resolveContext` method has a single `findByID` that also needs `req` for consistency

---

## Step 1: Add `req` Parameter to All ConversationService Methods

**~20 min | Single file change**

### Root Cause
All 12+ Payload operations in `ConversationService` run outside the caller's request transaction because `req` is never passed. This means if a write partially fails mid-`resetConversation`, the archive could succeed but the create could fail, leaving the user with no active conversation.

### Files to Touch

- `src/server/services/conversation-service.ts` (MODIFIED — lines 19, 72-532)

### Exact Behavior

1. **Add import** at line 19: Import `PayloadRequest` type from `payload`
   ```typescript
   import type { Payload, PayloadRequest } from 'payload'
   ```

2. **Add optional `req?: PayloadRequest` parameter** to every public method:
   - `getOrCreateActiveConversation(userId, contextRef, contextKeyOverride?, req?)` — lines 83-132
   - `resetConversation(userId, contextKey, req?)` — lines 138-197
   - `resolveContext(params, req?)` — lines 205-272
   - `validateContextAccess(userId, userRole, contextRef, req?)` — lines 286-329
   - `validateGuestContextAccess(guestSessionId, contextRef, req?)` — lines 335-342
   - `getConversationHistory(conversationId, req?)` — lines 347-359
   - `getActiveConversation(userId, contextKey, req?)` — lines 364-385
   - `getOrCreateGuestConversation(guestSessionId, contextRef, req?)` — lines 391-452
   - `getGuestConversation(guestSessionId, contextKey, req?)` — lines 457-475
   - `resetGuestConversation(guestSessionId, contextKey, req?)` — lines 480-532

3. **Pass `req` to every Payload operation** — add `...(req && { req })` spread to each operation's options object. This conditionally adds `req` only when provided, maintaining backward compatibility.

   Example transformation:
   ```typescript
   // BEFORE (line 91-101)
   const existingConv = await this.payload.find({
     collection: 'conversations',
     where: { ... },
     limit: 1,
   })

   // AFTER
   const existingConv = await this.payload.find({
     collection: 'conversations',
     where: { ... },
     limit: 1,
     ...(req && { req }),
   })
   ```

4. **All ~21 Payload operations** that need `req` added:
   - `getOrCreateActiveConversation`: `find` (line 91), `create` (line 113)
   - `resetConversation`: `find` (line 140), `update` (line 155), `create` (line 175) — **FR-003 atomicity**
   - `resolveContext`: `findByID` (line 215)
   - `getConversationHistory`: `findByID` (line 350)
   - `getActiveConversation`: `find` (line 368)
   - `getOrCreateGuestConversation`: `find` (line 397), `find` (line 418), `create` (line 431)
   - `getGuestConversation`: `find` (line 461)
   - `resetGuestConversation`: `find` (line 484), `update` (line 498), `create` (line 514) — **FR-003 atomicity**

### Test Gate

- Run existing service tests: `pnpm vitest run tests/unit/lib/services/conversation-service.spec.ts`
- Add/adjust tests only if pipeline requires it; implementation scope remains centered on `conversation-service.ts`.

### Acceptance Criteria

- [ ] Every public method on `ConversationService` accepts optional `req?: PayloadRequest` as final parameter
- [ ] All ~21 Payload operations conditionally include `req` when provided
- [ ] `resetConversation`'s find + update + create all receive the same `req` (FR-003)
- [ ] `resetGuestConversation`'s find + update + create all receive the same `req` (FR-003)
- [ ] Calling methods without `req` still works (backward compatibility, NFR-001)
- [ ] No `overrideAccess` changes — existing `overrideAccess: true` on archive updates is preserved (NFR-002)
- [ ] Existing conversation-service test suite passes
- [ ] `pnpm tsc --noEmit` passes

---

## Step 2: Add `req` Parameter to `buildContextHierarchy` Standalone Function

**~10 min | Single file change**

### Root Cause
`buildContextHierarchy` performs 1-3 `findByID` calls without `req`, breaking transaction context when called from within a request (e.g., from `vector-search.ts` during a chat pipeline request).

### Files to Touch

- `src/server/services/conversation-service.ts` (MODIFIED — lines 539-600): Add optional `req` parameter and propagate it to all Local API calls in this function

### Exact Behavior

1. **Update `buildContextHierarchy` signature** (line 539):
   ```typescript
   // BEFORE
   export async function buildContextHierarchy(
     contextKey: string,
     payload: Payload,
   ): Promise<string[]>

   // AFTER
   export async function buildContextHierarchy(
     contextKey: string,
     payload: Payload,
     req?: PayloadRequest,
   ): Promise<string[]>
   ```

2. **Add `req` to all `findByID` calls** inside `buildContextHierarchy` (lines 548-591):
   - Exercise findByID (line 548): `...(req && { req })`
   - Lesson findByID from exercise branch (line 556): `...(req && { req })`
   - Chapter findByID from exercise branch (line 564): `...(req && { req })`
   - Lesson findByID from lesson branch (line 572): `...(req && { req })`
   - Chapter findByID from lesson branch (line 579): `...(req && { req })`
   - Chapter findByID from chapter branch (line 587): `...(req && { req })`

3. **Do not update call sites in this task**: `req` remains optional to preserve compatibility and keep scope constrained to `conversation-service.ts` per guardrails.

### Test Gate

- Run existing service tests: `pnpm vitest run tests/unit/lib/services/conversation-service.spec.ts`
- Confirm `buildContextHierarchy` call sites still compile with optional `req` by running `pnpm tsc --noEmit`.

### Acceptance Criteria

- [ ] `buildContextHierarchy` accepts optional third parameter `req?: PayloadRequest` (FR-004)
- [ ] All 6 possible `findByID` calls conditionally include `req`
- [ ] Existing callers continue working unchanged because `req` is optional
- [ ] Existing tests for `buildContextHierarchy` still pass (they don't pass `req`)
- [ ] Existing conversation-service test suite passes
- [ ] `pnpm tsc --noEmit` passes

---

## Step 3: Verification and Safety Checks

**~10 min | No additional source files**

### Root Cause
This is a high-risk transactional fix. We need explicit verification that all Local API calls in `conversation-service.ts` now accept/propagate `req` and that no business logic or access semantics changed.

### Files to Touch

- No additional implementation files required beyond `src/server/services/conversation-service.ts`

### Exact Behavior

1. Run targeted tests for conversation service behavior and helper functions.
2. Run `pnpm tsc --noEmit` to confirm signature updates compile.
3. Confirm no query/filter/sort/select/shape changes were introduced while adding `req`.
4. Confirm no `overrideAccess` behavior changes were introduced (preserve existing semantics).

### Acceptance Criteria

- [ ] Conversation service unit tests pass
- [ ] `pnpm tsc --noEmit` passes with no type errors
- [ ] All Payload operations in `conversation-service.ts` include conditional `req` propagation
- [ ] No business logic drift (queries/results unchanged apart from request-context participation)
- [ ] No access-control semantic drift (`overrideAccess` behavior unchanged)

---

## Final Verification

After all 3 steps are complete:

```bash
# Type check
pnpm tsc --noEmit

# Run conversation service tests
pnpm vitest run tests/unit/lib/services/conversation-service.spec.ts

# Lint check
pnpm lint
```

### Full Acceptance Criteria (from Spec)

- [ ] **FR-001**: `ConversationService` exposes clear API receiving `req`/`PayloadRequest` context (per-method optional parameter)
- [ ] **FR-002**: Every Payload operation in `conversation-service.ts` includes `req` in its options (conditionally)
- [ ] **FR-003**: `resetConversation` and `resetGuestConversation` execute all writes using the same `req` — atomic behavior
- [ ] **FR-004**: `buildContextHierarchy` accepts optional `req` parameter for transaction-safe operation
- [ ] **NFR-001**: No observable changes in business logic, query behavior, or response shapes
- [ ] **NFR-002**: No access-control changes — no new `overrideAccess` additions/removals
- [ ] **NFR-003**: Uses `PayloadRequest` type from `payload` for clear type contract
- [ ] No new collections/endpoints introduced — change is scoped to `src/server/services/conversation-service.ts`
