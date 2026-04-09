### build (2026-03-31T12:47:04)

All checks pass. Here's a summary of the fixes made:

**Changes:**

1. **`src/server/payload/migrations/localize-teacher-profiles.ts`**
   - Removed `LegacyTeacherProfile` interface that was maintaining the old schema definition
   - Changed cast from `as unknown as LegacyTeacherProfile` to `as any`

2. **`src/server/payload/seed/teacher-profiles-seed.ts`**
   - Restructured `TEACHER_PROFILES` data from flat `label_he`/`label_en`/`description_he`/`description_en` properties to nested `he.label`/
     ...(truncated)

### review (2026-03-31T12:50:09)

The migration file legitimately references old field names (`label_he`, `label_en`, etc.) because it reads from the legacy schema to convert to the new per-locale structure. This is expected and correct for a migration.

## Review Summary

### Verdict: PASS

### Human Feedback Status

**1. LegacyTeacherProfile removed** ✓

- No references found in `src/` - clean

**2. `_en` and `_he` prefixes removed** ✓

- Only remaining references are in the migration file (`localize-teacher-profiles.ts`) which
  ...(truncated)

### review-fix (2026-03-31T12:52:17)

All Major issues fixed. Summary:

**Major Issue 1 - `src/server/services/teacher-profile-resolver.ts`:**

- Added optional `locale` parameter to `resolveTeacherProfile()`
- Added optional `locale` parameter to `resolveTier2DefaultProfile()` and `resolveTier3FirstActive()`
- Both Tier 2 and Tier 3 queries now filter by locale when provided

**Major Issue 2 - `src/app/api/user-settings/route.ts`:**

- Added locale extraction in PATCH handler via `getLocaleFromRequest(req)`
- Profile validation quer
  ...(truncated)
