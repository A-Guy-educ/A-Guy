
### taskify (2026-03-30T07:58:35)
```json
{
  "task_type": "feature",
  "title": "Localize teacher profile selection UI and content (Hebrew/English)",
  "description": "Add Hebrew and English language support to teacher profile selection interface and profile content. Implement dual-language fields in TeacherProfiles collection (label, description), update API endpoints to serve localized content, and ensure UI dynamically displays content in the user's active language. Includes data migration for existing profiles.",
  "scope":
...(truncated)

### plan (2026-03-30T08:00:34)
Now I have a complete picture. Let me create the implementation plan.

---

## Implementation Plan: Localize Teacher Profile Selection (Hebrew/English)

### Step 1: Add localized fields to TeacherProfiles collection schema

**File:** `src/server/payload/collections/TeacherProfiles.ts`
**Change:** Replace single `label` and `description` fields with locale-aware groups: `label_en`, `label_he`, `description_en`, `description_he`. Keep original `label` and `description` as computed/display fields i
...(truncated)

### build (2026-03-30T08:09:47)
All done. Here's a summary of what was implemented:

**Files changed:**

1. **`TeacherProfiles.ts`** — Replaced `label`/`description` with `label_en`, `label_he`, `description_en`, `description_he`. Updated `useAsTitle` to `label_en`.

2. **`teacher-profiles-seed.ts`** — Added Hebrew translations for all 5 profiles. Seed now writes the four localized fields and **updates** existing profiles (instead of skipping) to backfill translations.

3. **`src/app/api/teacher-profiles/route.ts`** — Reads lo
...(truncated)

### review (2026-03-30T08:16:06)
All fixes applied. Here's a summary of changes made based on your feedback:

**Changes:**

1. **`TeacherProfiles.ts`** - Changed `useAsTitle` from `label_en` to `slug` (you said "no" to using `label_en`)

2. **`src/i18n/get-locale-from-request.ts`** (new) - Extracted the duplicated `getLocaleFromRequest` function into a shared utility

3. **`teacher-profiles/route.ts`** - Uses shared locale utility, sorts by locale-appropriate field (`label_he` or `label_en`), adds `?? ''` fallback for nullable 
...(truncated)
