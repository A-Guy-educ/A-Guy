# Plan: 260310-auto-320 — Per-Block Raw JSON Editor for Exercises

## Overview

Enhance the existing Exercise Content Editor's JSONInspector to support safe, structure-locked raw JSON editing of individual exercise blocks. Based on the **clarified requirements**, the feature:

1. **Is open to everyone** (no role gating — no "Advanced Content Editor" role needed)
2. **Applies to Exercises only** (not Pages or Posts)
3. **Focuses on question selection blocks** (the existing block selection in ExerciseContentEditor)

The implementation enhances the existing JSONInspector with structure invariance validation, improves the AdvancedJsonPanel in QuestionBlockWrapper, adds a dedicated server-side block-patch endpoint with validation, and fixes the incomplete block type validation list.

---

## Steps

### Step 1: Create Structure Invariance Validator Utility

**Files:**
- `src/server/services/exercise-validation/structure-validator.ts` (NEW)
- `src/server/services/exercise-validation/index.ts` (NEW)

**Behavior:**
Create a shared utility function `validateStructuralInvariance(original, edited)` that:
- Recursively compares two JSON values to ensure identical key sets at every object level
- Ensures no array length changes at any level
- Ensures reserved metadata (`id`, `type`, `variant`, `blockType`) are immutable
- Returns `{ valid: true }` or `{ valid: false, errors: [{ path: string, message: string, type: 'key_added' | 'key_removed' | 'array_length' | 'metadata_changed' | 'type_changed' }] }`
- Sanitizes for prototype pollution keys (`__proto__`, `prototype`, `constructor`)
- Works isomorphically (importable from both server and client code)

**Tests:**
- `tests/unit/structure-validator.test.ts` (NEW)
  - Key addition at root level → rejected with path
  - Key removal at nested level → rejected with path
  - Array length change → rejected with path
  - `id` field changed → rejected
  - `type` field changed → rejected
  - `variant` field changed → rejected
  - Value-only changes at all nesting levels → accepted
  - Prototype pollution keys → stripped/rejected
  - Empty objects and arrays → handled correctly
  - Deep nesting (5+ levels) → works correctly

**Acceptance Criteria:**
- [ ] Function correctly identifies all structural violations with specific JSON paths
- [ ] Prototype pollution keys rejected
- [ ] All tests pass

---

### Step 2: Enhance JSONInspector with Structure Validation

**Files:**
- `src/ui/admin/ExerciseContentEditor/JSONInspector.tsx` (MODIFIED, lines 52-90 validation logic)

**Behavior:**
1. Fix the incomplete `validTypes` array (line 77-83) to include ALL 12 block types: `rich_text`, `question_select`, `question_free_response`, `question_table`, `latex`, `question_matching`, `svg`, `question_geometry`, `question_axis`, `html`, `media`
2. Import `validateStructuralInvariance` from the new utility
3. In `validateJSON()` (line 52), after JSON parse succeeds:
   - Run `validateStructuralInvariance(originalBlock, parsedBlock)` comparing against the `block` prop (original)
   - If structure validation fails, return error with type `'structure'` and include at least one offending path
4. In `handleApply()` (line 92), enforce that validation passes before calling `onApply`
5. Update error display to differentiate:
   - JSON syntax errors: "Invalid JSON: [parse error details]"
   - Structure errors: "Structure change not allowed: [path] — [reason]"
6. Preserve existing cancel behavior — cancel reverts to original block JSON and clears errors

**Tests:**
- Manual testing via admin UI (verified in Step 6 integration test):
  - Edit a value → Apply succeeds
  - Add a key → Apply blocked with structure error showing path
  - Remove a key → Apply blocked
  - Change array length → Apply blocked
  - Change `id` field → Apply blocked
  - Change `type` field → Apply blocked
  - Cancel after invalid edit → reverts to original

**Acceptance Criteria:**
- [ ] All 12 block types recognized in validation
- [ ] Structure changes blocked with clear error messages
- [ ] Value-only changes allowed
- [ ] Cancel reverts state cleanly

---

### Step 3: Enhance AdvancedJsonPanel with Structure Validation

**Files:**
- `src/ui/admin/shared/AdvancedJsonPanel.tsx` (MODIFIED)

**Behavior:**
1. Add `originalValue` prop (the original block before editing, for structure comparison)
2. Import `validateStructuralInvariance` from the utility
3. On each keystroke that produces valid JSON:
   - Run structure validation against `originalValue`
   - If structure violation detected, show error but do NOT call `onChange`
   - Display structure error with offending path
4. Only call `onChange` when JSON is valid AND structure is preserved
5. This protects the `QuestionBlockWrapper` use case where AdvancedJsonPanel passes changes directly to `onBlockChange`

**Tests:**
- Manual testing via question block editors:
  - Edit value in Advanced JSON panel → change applied
  - Add key in Advanced JSON panel → error shown, change not applied
  - Remove key → error shown
  - Invalid JSON → existing error behavior unchanged

**Acceptance Criteria:**
- [ ] AdvancedJsonPanel prevents structural changes
- [ ] Error messages clearly indicate structure vs syntax issues
- [ ] Changes only propagate to parent when valid + structure-preserving

---

### Step 4: Create Server-Side Block Patch Endpoint

**Files:**
- `src/app/api/exercises/[id]/blocks/[blockId]/route.ts` (NEW)

**Behavior:**
Create a `PATCH` endpoint that:
1. **Authentication**: Requires authenticated user (uses `withApiHandler` with `auth: 'authenticated'`)
2. **Authorization**: Verifies user can update the exercise (admin or owner, matching collection access control)
3. **Input validation** with Zod:
   ```typescript
   z.object({
     block: z.record(z.unknown()), // the edited block payload
     updatedAt: z.string().optional(), // optimistic concurrency check
   })
   ```
4. **Processing**:
   - Fetch exercise by `id` with `overrideAccess: false` and user context
   - Find existing block by `blockId` in `content.blocks`
   - If not found, return 404
   - Run `validateStructuralInvariance(existingBlock, submittedBlock)` — reject if fails (400)
   - Run `ContentBlockSchema.safeParse(submittedBlock)` — reject if fails (400)
   - Sanitize for prototype pollution keys
   - If `updatedAt` provided, compare with document's `updatedAt` — reject on mismatch (409 Conflict)
   - Replace only the targeted block in `content.blocks` array (matched by `blockId`)
   - Save via `payload.update` with `req` for transaction safety
5. **Response**: Return updated block on success, or structured error on failure
6. **Audit**: Log successful edits with user ID, exercise ID, block ID, block type

**Tests:**
- `tests/int/exercise-block-patch.int.spec.ts` (NEW)
  - Authenticated user can patch own exercise block values → 200
  - Unauthenticated request → 401
  - User patching someone else's exercise → 403
  - Admin can patch any exercise → 200
  - Block not found → 404
  - Structure change attempt → 400 with path details
  - Invalid JSON schema → 400
  - Prototype pollution keys → 400
  - Only targeted block changes, others unchanged → verified
  - Optimistic concurrency mismatch → 409

**Acceptance Criteria:**
- [ ] Server-side structure invariance enforced
- [ ] Authorization enforced (admin or owner)
- [ ] Only targeted block updated
- [ ] Prototype pollution prevented
- [ ] Proper HTTP error codes for all failure modes

---

### Step 5: Wire JSONInspector Apply to Server Endpoint

**Files:**
- `src/ui/admin/ExerciseContentEditor/JSONInspector.tsx` (MODIFIED)
- `src/ui/admin/ExerciseContentEditor/index.tsx` (MODIFIED, ~lines 212-216)

**Behavior:**
1. In `JSONInspector`, add optional `exerciseId` and `onServerApply` props:
   - `exerciseId?: string` — the document ID (from `useDocumentInfo`)
   - `onServerApply?: (blockId: string, block: ContentBlock) => Promise<{ success: boolean; error?: string }>`
2. In `handleApply()`:
   - After client-side validation passes, if `onServerApply` is provided, call it
   - Show loading state during server call
   - On server success, call `onApply` to update local state
   - On server failure, show server error message (do not apply locally)
3. In `ExerciseContentEditor`:
   - Import `useDocumentInfo` from `@payloadcms/ui` to get exercise `id`
   - Create `handleServerApply` function that calls `PATCH /api/exercises/[id]/blocks/[blockId]`
   - Pass `exerciseId` and `onServerApply` to `JSONInspector`
   - On successful server response, update local state and mark form as needing save

**Tests:**
- Integration test (manual + E2E):
  - Apply valid edit via JSONInspector → server validates and persists
  - Apply structural change → server rejects, UI shows error, local state unchanged
  - Network error → graceful error message shown

**Acceptance Criteria:**
- [ ] JSON edits go through server validation before local state update
- [ ] Server errors displayed in JSONInspector UI
- [ ] Loading state shown during server call
- [ ] Local state only updates on server success

---

### Step 6: Integration Testing and Validation

**Files:**
- `tests/unit/structure-validator.test.ts` (verified from Step 1)
- `tests/int/exercise-block-patch.int.spec.ts` (verified from Step 4)

**Behavior:**
1. Run all unit tests for structure validator
2. Run integration tests for block patch endpoint
3. Run TypeScript type checking: `pnpm tsc --noEmit`
4. Run linting: `pnpm lint`
5. Verify no regressions in existing exercise editing flow

**Tests:**
- All unit tests pass
- All integration tests pass
- TypeScript compiles without errors
- Lint passes

**Acceptance Criteria:**
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] All new tests pass
- [ ] Existing exercise editing unchanged for standard (non-JSON) editors

---

## Assumptions

1. **No role gating needed**: Per clarified.md, the feature is open to everyone (no Advanced Content Editor role creation). This simplifies FR-001, FR-008, and NFR-006 from the original spec.
2. **Exercises only**: Per clarified.md item 2, this applies only to Exercises collection, not Pages or Posts.
3. **Question selection context**: Per clarified.md item 3, the block selection mechanism already exists in ExerciseContentEditor via `selectedBlockId` state. The JSONInspector already receives the selected block.
4. **AdvancedJsonPanel in QuestionBlockWrapper**: The existing AdvancedJsonPanel (collapsed, in every question block) also needs structure validation since it directly mutates block state without any validation beyond JSON.parse.
5. **Existing save flow preserved**: The ExerciseContentEditor's "Save Changes" button flow (local state → setValue → form submit) continues to work. The server endpoint is an additional validation layer used by JSONInspector's Apply action.
6. **Optimistic concurrency is SHOULD-level**: The `updatedAt` check is included but optional — the endpoint works without it.
7. **Audit logging uses console/Pino**: No separate audit collection needed — server-side logging of edits satisfies NFR-004 for now.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Structure validator too strict (rejects valid edits) | Medium | High | Comprehensive unit tests with all 12 block types; allow value type changes (string→string, number→number) |
| JSONInspector `block` prop stale during editing | Low | Medium | Use the `block` prop as the "original" reference; it represents the last-saved state from parent |
| AdvancedJsonPanel live-editing causes performance issues with structure validation | Medium | Low | Debounce structure validation (only run on apply/blur, not every keystroke) |
| Server endpoint auth doesn't match collection access control | Low | High | Reuse same `isAdminOrOwner` logic; test with admin and owner users |
| Import cycle between server validation and client components | Medium | Medium | Keep structure validator in `src/server/services/` with no Payload dependencies so it can be imported from client |
| Existing tests break due to new validation | Low | Medium | New validation is additive — only blocks structural changes, which were never valid before |
