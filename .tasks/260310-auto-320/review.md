# Code Review: 260310-auto-320 — Per-Block Raw JSON Editor for Exercises

## Summary

Reviewed 4 changed/new files implementing structure invariance validation for exercise block JSON editing, plus a server-side block patch endpoint. The implementation has **2 critical** issues (one is a security authorization bypass), **3 major** issues, and **5 minor** issues.

---

## Critical

### C1: Authorization bypass — `user.roles` vs `user.role` (singular)

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:99`

The endpoint checks `user.roles?.includes('admin')` but the Users collection defines a **singular** `role` field (`type: 'select'`, not `hasMany`). The user object has `user.role` (a string), not `user.roles` (an array). This means `user.roles` is always `undefined`, so `.includes('admin')` will throw a TypeError at runtime or always evaluate falsy, causing **all admin users to be denied access**.

```typescript
// ❌ Current (line 99)
const isAdmin = user.roles?.includes('admin')

// ✅ Fix
const isAdmin = user.role === 'admin'
```

**Impact:** The admin authorization check is completely broken. Admin users will be denied access to the patch endpoint.

---

### C2: Owner field mismatch — `exercise.owner` does not exist

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:100`

The endpoint checks `exercise.owner === user.id` but the Exercises collection does not have an `owner` field. It has a `createdBy` field (from `createdByField` in `src/server/payload/fields/createdBy.ts:3`). The `exercise.owner` will always be `undefined`, so non-admin users can **never** pass the authorization check, even for their own exercises.

```typescript
// ❌ Current (line 100)
const isOwner = exercise.owner === user.id

// ✅ Fix
const isOwner = exercise.createdBy === user.id
```

Note: The collection-level access control function `isAdminOrOwner` (in `src/server/payload/collections/Exercises/index.ts:26`) also queries `{ owner: { equals: user.id } }` which appears to have the same mismatch — this may be a pre-existing bug in the codebase, but the new endpoint replicates it.

**Impact:** Non-admin exercise creators cannot patch their own exercise blocks via the API endpoint, effectively making the endpoint admin-only (and broken for admins too per C1).

---

## Major

### M1: Fabricated `req` object bypasses Payload middleware

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:91,181`

The endpoint constructs a fake `req` object `{ payload, user } as never` for Payload Local API calls. This is unsafe because:

1. The `as never` cast silences all type checking — Payload expects a full `PayloadRequest` with headers, locale, context, transactionID etc.
2. The `findByID` with `overrideAccess: false` depends on `req.user` being set in the proper Payload request context. A fabricated req may not trigger access control correctly.
3. The `payload.update` call on line 173-182 also uses this pattern, risking transaction isolation issues.

The project already has `withApiHandler` (`src/server/api/with-api-handler.ts`) that properly authenticates and provides a full `ApiContext`. The endpoint should use this pattern instead of manual auth + fabricated req.

```typescript
// ❌ Current pattern
const payload = await getPayload({ config })
const authResult = await payload.auth({ headers: request.headers })
// ...
await payload.findByID({ ..., req: { payload, user } as never })

// ✅ Should use withApiHandler
export const PATCH = withApiHandler({ auth: 'authenticated', bodySchema: BlockPatchRequestSchema }, 
  async (ctx) => { /* use ctx.payload, ctx.user */ }
)
```

**Impact:** Access control may not be properly enforced on findByID/update calls. Potential data integrity risk from missing transaction context.

---

### M2: `AdvancedJsonPanel.originalValue` prop never passed by `QuestionBlockWrapper`

**File:** `src/ui/admin/ExerciseContentEditor/editors/QuestionBlockWrapper.tsx:82-86`

The `AdvancedJsonPanel` was enhanced with an `originalValue` prop for structure validation, but `QuestionBlockWrapper` does not pass it:

```tsx
// QuestionBlockWrapper.tsx:82-86
<AdvancedJsonPanel
  value={block}
  onChange={(value) => onBlockChange(value as ContentBlock)}
  label="Advanced JSON"
  // ❌ Missing: originalValue={block}
/>
```

Without `originalValue`, the structure validation in `AdvancedJsonPanel` (line 47: `if (originalValue !== undefined)`) is never triggered. This means the `AdvancedJsonPanel` in question block wrappers provides **zero structure protection**, which was a key goal of Step 3 in the plan.

**Impact:** Structure invariance validation is only enforced in the `JSONInspector` panel, not in the per-block `AdvancedJsonPanel`. Users can make structural changes through the Advanced JSON panel in any question block.

---

### M3: Plan specified server-endpoint wiring (Step 5) not implemented

**File:** `src/ui/admin/ExerciseContentEditor/index.tsx:213-216`

The plan's Step 5 called for wiring `JSONInspector`'s Apply action to the server-side PATCH endpoint for server-validated saves. The `JSONInspector` component was supposed to receive `exerciseId` and `onServerApply` props, and `ExerciseContentEditor` was supposed to call the PATCH endpoint before applying local state.

This wiring was never implemented. The `handleJsonApply` function (line 213-216) directly updates local state without any server-side validation:

```typescript
const handleJsonApply = (updatedBlock: ContentBlock) => {
  if (!selectedBlockId) return
  handleUpdateBlock(selectedBlockId, updatedBlock) // Direct local update, no server call
}
```

**Impact:** The server-side endpoint exists but is never called by the UI. All validation is client-side only, contradicting FR-007 (server-side enforcement). The endpoint is dead code from a UI perspective.

---

## Minor

### m1: No unit tests for structure validator

**File:** Plan Step 1 specified `tests/unit/structure-validator.test.ts`

The plan called for comprehensive unit tests (11 test cases) for `validateStructuralInvariance`. No test file was created. The build report claims "3199 tests pass" but doesn't mention these specific tests. The glob search `tests/unit/structure-validator*` returns no files.

**Impact:** No automated verification of the core validation logic. Regressions could go undetected.

---

### m2: Redundant authorization after `overrideAccess: false`

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:86-107`

The endpoint performs `findByID` with `overrideAccess: false` (which enforces the collection's `read` access control), and then separately checks admin/owner authorization (lines 98-107). Since the `read` access is `anyone` (public), the `findByID` will always succeed. The manual admin/owner check duplicates the collection's `update` access pattern but with the wrong field name (see C2). 

The endpoint should either:
- Trust the collection's access control and use `payload.update` with `overrideAccess: false` (which checks `isAdminOrOwner`), or
- Do the manual check correctly

**Impact:** Confusing redundant logic that doesn't match the collection's actual access control.

---

### m3: Error details leaked in 500 response

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:210`

The catch block returns `error.message` in the response body:

```typescript
details: error instanceof Error ? error.message : 'Unknown error'
```

In production, internal error messages may leak implementation details (e.g., MongoDB connection strings, file paths, stack traces). The `withApiHandler` pattern properly sanitizes this.

**Impact:** Minor information disclosure risk.

---

### m4: `eslint-disable` comments for `@typescript-eslint/no-explicit-any`

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:26,32,34`

Three `eslint-disable` comments suppress `no-explicit-any` for the `AuthenticatedUser` and `ExerciseWithOwner` interfaces. These types could be properly typed using the generated Payload types:

```typescript
import type { User } from '@/payload-types'
import type { Exercise } from '@/payload-types'
```

**Impact:** Lost type safety; inconsistent with project patterns that import from `@/payload-types`.

---

### m5: `console.info` used for audit logging instead of structured logger

**File:** `src/app/api/exercises/[id]/blocks/[blockId]/route.ts:185`

The audit log uses `console.info` which produces unstructured output. The project has a structured logging pattern via `createApiLogger` (used in `withApiHandler`). Per NFR-004, audit records should be suitable for incident response.

```typescript
// ❌ Current
console.info('[exercise-block-patch] Block updated', { ... })

// ✅ Should use
const logger = createApiLogger(request, 'exercise-block-patch')
logger.info({ userId, exerciseId, blockId, blockType }, 'Block updated')
```

**Impact:** Audit logs may not be captured by log aggregation tools or searchable for incident response.

---

## Spec Compliance Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-001 (Role gating) | N/A | Clarified: open to everyone — correctly skipped |
| FR-002 (Per-block scoped view) | ✅ | JSONInspector shows selected block |
| FR-003 (Structure locked) | ⚠️ Partial | JSONInspector validates, AdvancedJsonPanel does not (M2) |
| FR-004 (Parse + invariance validation) | ✅ | Client-side validation with clear errors |
| FR-005 (Cancel discards) | ✅ | Cancel reverts to original block |
| FR-006 (Block-level isolation) | ✅ | Only selected block updated |
| FR-007 (Server-side enforcement) | ❌ | Endpoint exists but is never called (M3), and has auth bugs (C1, C2) |
| FR-008 (Create role) | N/A | Clarified: not needed |
| NFR-001 (overrideAccess: false) | ⚠️ | Used but with fabricated req (M1) |
| NFR-002 (Prototype pollution) | ✅ | Sanitization implemented |

---

## Verdict

**CHANGES REQUESTED** — The critical authorization bugs (C1, C2) would cause the server endpoint to reject all requests. The missing server-endpoint wiring (M3) means the endpoint is dead code. The `AdvancedJsonPanel` lacks structure validation in practice (M2).

Minimum fixes required before merge:
1. Fix `user.roles` → `user.role` (C1)
2. Fix `exercise.owner` → `exercise.createdBy` (C2)
3. Pass `originalValue` to `AdvancedJsonPanel` in `QuestionBlockWrapper` (M2)
4. Either wire the endpoint to the UI or remove it to avoid dead code (M3)
