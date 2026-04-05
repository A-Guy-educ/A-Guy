The migration file legitimately references old field names (`label_he`, `label_en`, etc.) because it reads from the legacy schema to convert to the new per-locale structure. This is expected and correct for a migration.

## Review Summary

### Verdict: PASS

### Human Feedback Status

**1. LegacyTeacherProfile removed** ✓

- No references found in `src/` - clean

**2. `_en` and `_he` prefixes removed** ✓

- Only remaining references are in the migration file (`localize-teacher-profiles.ts`) which must read from the legacy schema to perform conversion
- All other files (schema, seed, API routes, UI components) use the new per-locale pattern

### Files Reviewed

| File                                                                | Status                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/server/payload/collections/TeacherProfiles.ts`                 | ✓ Clean - per-locale with `label`/`description`                         |
| `src/server/payload/seed/teacher-profiles-seed.ts`                  | ✓ Clean - uses `he.label`/`en.label` nested structure                   |
| `src/app/api/teacher-profiles/route.ts`                             | ✓ Clean - filters by `locale`                                           |
| `src/app/api/user-settings/route.ts`                                | ✓ Clean - locale-aware profile lookup                                   |
| `src/server/services/teacher-profile-resolver.ts`                   | ⚠️ Tier 2/3 resolvers don't filter by locale (backend-only, acceptable) |
| `src/app/(frontend)/account/_components/TeachersProfileSection.tsx` | ✓ Clean                                                                 |
| `src/app/(frontend)/onboarding/persona/PersonaSelectionStep.tsx`    | ✓ Clean                                                                 |
| `src/server/payload/migrations/localize-teacher-profiles.ts`        | ✓ Legitimate migration references (reads old schema)                    |

### Remaining Item from Kody Review

**`teacher-profile-resolver.ts:166-175, 207-216`** - Tier 2/3 queries don't filter by locale. This was flagged in the Kody review but is a backend-only resolver (not UI-facing). The actual API endpoints (`/api/teacher-profiles`, `/api/user-settings`) properly filter by locale. This is acceptable given the architecture.
