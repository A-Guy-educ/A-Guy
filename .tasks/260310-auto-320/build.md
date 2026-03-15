# Build Report: Per-Block Raw JSON Editor for Exercises (260310-auto-320)

## Summary

Implemented a per-block raw JSON editor for Exercises with structure invariance validation. Based on the clarified requirements:
1. **Open to everyone** - No role gating (Advanced Content Editor role not needed)
2. **Applies to Exercises only** - Not Pages or Posts
3. **Question selection context** - Enhanced existing block editing capabilities

## Changes

### Files Created

1. **`src/utils/structure-validator.ts`** (NEW)
   - Pure validation functions usable from both client and server
   - `validateStructuralInvariance(original, edited)`: Validates JSON structure matches original
   - `sanitizePrototypePollution(obj)`: Removes dangerous prototype pollution keys
   - Validates: key additions/removals, array length changes, reserved metadata changes (id, type, blockType, variant)
   - Returns detailed error objects with path and violation type

2. **`src/app/api/exercises/[id]/blocks/[blockId]/route.ts`** (NEW)
   - Server-side PATCH endpoint for block updates
   - Features:
     - Authentication required
     - Authorization (admin or owner)
     - Structure invariance validation (rejects structural changes)
     - Prototype pollution protection
     - Optimistic concurrency support (via updatedAt)
     - Schema validation against ContentBlockSchema
     - Audit logging for successful edits

### Files Modified

3. **`src/ui/admin/ExerciseContentEditor/JSONInspector.tsx`** (MODIFIED)
   - Fixed incomplete `VALID_BLOCK_TYPES` array - now includes all 11 block types
   - Added structure validation using `validateStructuralInvariance`
   - Enhanced error messages to differentiate:
     - JSON syntax errors: "Invalid JSON: [parse error]"
     - Structure errors: "Structure change not allowed: [path] — [reason]"
   - Validation runs on Apply before accepting changes

4. **`src/ui/admin/shared/AdvancedJsonPanel.tsx`** (MODIFIED)
   - Added optional `originalValue` prop for structure comparison
   - Added structure validation on each JSON change
   - Blocks structural changes from being applied to parent state
   - Shows clear error messages for structure violations

### Files Removed

- Removed `src/server/services/exercise-validation/` (redundant - moved to shared utils)

## Key Features Implemented

1. **Structure Invariance Validation**
   - Prevents adding/removing keys at any nesting level
   - Prevents array length changes
   - Protects reserved metadata (id, type, blockType, variant)
   - Clear error messages with JSON path and violation type

2. **Security Hardening**
   - Server-side validation endpoint for additional protection
   - Prototype pollution prevention
   - Authorization checks)
   - Optim (admin or owneristic concurrency to prevent overwrites

3. **UX Improvements**
   - Clear error differentiation (syntax vs structure)
   - Cancel discards invalid edits and reverts to original
   - Apply only succeeds when structure is preserved

## Verification

- **TypeScript**: `pnpm tsc --noEmit` ✅ passes
- **Lint**: `pnpm lint` ✅ passes (no errors)
- **Format**: `pnpm format --check` ✅ passes
- **Unit Tests**: 3199 tests pass (2 pre-existing failures unrelated to changes)

## Notes

- Per clarified.md, the Advanced Content Editor role was NOT created (feature is open to everyone)
- The server endpoint provides security hardening but the primary validation happens client-side in JSONInspector
- AdvancedJsonPanel was enhanced with structure validation support (though it requires `originalValue` prop to be effective)
