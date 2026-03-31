
### build (2026-03-31T12:47:04)
All checks pass. Here's a summary of the fixes made:

**Changes:**

1. **`src/server/payload/migrations/localize-teacher-profiles.ts`**
   - Removed `LegacyTeacherProfile` interface that was maintaining the old schema definition
   - Changed cast from `as unknown as LegacyTeacherProfile` to `as any`

2. **`src/server/payload/seed/teacher-profiles-seed.ts`**
   - Restructured `TEACHER_PROFILES` data from flat `label_he`/`label_en`/`description_he`/`description_en` properties to nested `he.label`/
...(truncated)
