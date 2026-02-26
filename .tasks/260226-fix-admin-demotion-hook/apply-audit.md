# Apply Audit Report: 260226-fix-admin-demotion-hook

## Improvements Applied

| #   | Type | Where    | Status              |
| --- | ---- | -------- | ------------------- |
| 1   | DOC  | AGENTS.md | status: IMPLEMENTED |

## Changes Made

- **AGENTS.md** (lines 183-185): Added critical security note explaining the counterintuitive behavior of `overrideAccess: false`:
  > ⚠️ **CRITICAL SECURITY NOTE**: `overrideAccess: false` filters queries by the **current user's** access control, not the `user` parameter. This is counterintuitive for system-level operations. For example, counting admins with `overrideAccess: false` will return 0 if the current user is not an admin, potentially causing the last admin to be demoted. Use `overrideAccess: true` for system operations that must bypass all access control.

This documentation improvement was added to the Local API Access Control section (the same section that describes the security bug fixed in this task), making it highly visible to developers working with hooks and access control.

## Suggested Improvements (Not Applied)

1. **Type:** GUARDRAIL
   - **Title:** Add security lint rule for Local API access control
   - **Where:** `eslint.config.mjs` or `src/lib/eslint/`
   - **Reason:** Not in safe-path whitelist - paths under `src/` and root config files are not whitelisted for direct editing
   - **Suggestion:** Implement as a custom ESLint rule in the project's linting infrastructure

2. **Type:** CODE_PATTERN
   - **Title:** Add helper function for system-level operations
   - **Where:** `src/server/payload/collections/Users/hooks/` or `src/access/`
   - **Reason:** Not in safe-path whitelist - `src/**` paths are outside the allowed edit scope
   - **Suggestion:** Create a helper function like `countAdmins()` that always uses `overrideAccess: true` for security-sensitive counts

3. **Type:** AUTOMATION
   - **Title:** Add security-focused code review checklist
   - **Where:** `.github/CODEOWNERS` or `docs/security-checklist.md`
   - **Reason:** Not in safe-path whitelist - `.github/` (except workflows) and `docs/` are not whitelisted
   - **Suggestion:** Add security review requirement for hooks that query users/roles/permissions collections

## Notes

- The primary security bug fix (`overrideAccess: false` → `overrideAccess: true`) was already implemented in the build stage of this task
- Unit tests (6 test cases) were added to prevent regression - excellent security practice
- Only documentation improvement was applied via this audit (AGENTS.md is in the safe-path whitelist)
- All three suggested improvements are valid but require code changes outside the safe-path whitelist scope
