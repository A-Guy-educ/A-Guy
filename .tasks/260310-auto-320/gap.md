# Gap Analysis: 260310-auto-320

## Summary

- Gaps Found: 6
- Spec Revised: Yes

## Gaps Found

### Gap 1: Advanced Content Editor Role Does Not Exist

**Severity:** Critical
**Location:** `src/infra/auth/roles.ts`, `src/server/payload/collections/Users/index.ts`
**Issue:** The spec assumes an "Advanced Content Editor" role exists, but the system only has two roles: `Admin` and `Student`. The role must be created and added to the role system.
**Fix Applied:** Added FR-008: Create Advanced Content Editor role in AccountRole enum with Hebrew label עורך תוכן מתקדם.

### Gap 2: Exercises Uses Custom JSON Field, Not Blocks Field

**Severity:** Critical
**Location:** `src/server/payload/collections/Exercises/index.ts` (line 117)
**Issue:** The spec mentions "blocks" but Exercises stores content in a `json` field with custom Zod schema validation. The JSONInspector component exists in `ExerciseContentEditor` but works differently than a standard Payload blocks field editor.
**Fix Applied:** Updated FR-002 to clarify that Exercises use a custom JSON content structure with per-block editing via JSONInspector, while Pages use Payload's built-in blocks field.

### Gap 3: Structure Invariance Not Enforced in Existing JSONInspector

**Severity:** High
**Location:** `src/ui/admin/ExerciseContentEditor/JSONInspector.tsx`
**Issue:** The existing JSONInspector only does basic type validation (lines 72-86), but does NOT enforce:
- No adding/removing keys
- No changing array lengths
- Reserved metadata immutability (`id`, `type`, etc.)
**Fix Applied:** Updated FR-003 to specify exact structure invariance rules and added FR-004 for validation requirements.

### Gap 4: Server-Side Patch Endpoint Does Not Exist

**Severity:** High
**Location:** No existing endpoint for block-level patching
**Issue:** FR-007 requires server-side enforcement, but there's no dedicated API endpoint for block-level updates. The current implementation relies entirely on client-side validation before the form submits.
**Fix Applied:** Added FR-007 with specific requirements for server-side patch capability.

### Gap 5: Role-Gating Not Implemented on Existing JSONInspector

**Severity:** High
**Location:** `src/ui/admin/ExerciseContentEditor/index.tsx`
**Issue:** The JSON edit button (Code icon, line 315-322) is visible to ALL users. There's no role check before showing the JSON panel.
**Fix Applied:** Updated FR-001 to require role-gating and updated Acceptance Criteria to verify only Advanced Content Editor can see/access the feature.

### Gap 6: Pages vs Exercises Have Different Block Implementations

**Severity:** Medium
**Location:** `src/server/payload/collections/Pages/index.ts` vs `Exercises/index.ts`
**Issue:** 
- Exercises: Custom `json` field with ExerciseContentEditor + JSONInspector
- Pages: Native Payload `blocks` field with built-in admin UI

The spec mentions both but doesn't clarify which gets the new feature first or how integration differs.
**Fix Applied:** Updated spec to scope primarily to Exercises (where JSON editing is most valuable) and clarified that Pages would require different integration (field-level component override).

## Changes Made to Spec

- Added FR-008: Create Advanced Content Editor role (`AccountRole.AdvancedContentEditor = 'advanced_content_editor'`) with Hebrew label עורך תוכן מתקדם, saved to JWT
- Updated FR-001: Role-gated availability now explicitly requires creating the role first
- Updated FR-002: Clarified per-block scoping works differently for Exercises (JSONInspector) vs Pages (would need custom field component)
- Added explicit structure invariance rules in FR-003 (no key add/remove, no array length changes, reserved metadata immutable)
- Added FR-004: JSON parsing + structural invariance validation with error messaging requirements
- Added FR-007: Server-side enforcement via dedicated patch capability with auth/authorization/validation requirements
- Updated Acceptance Criteria: Added verification for role existence check
- Added NFR-006: Role must be created before feature can be used

## No Gaps Found

If no gaps are identified, write:

```markdown
# Gap Analysis: <task-id>

## Summary

- Gaps Found: 0
- Spec Revised: No

No gaps identified. The spec is complete and aligned with codebase patterns.
```
