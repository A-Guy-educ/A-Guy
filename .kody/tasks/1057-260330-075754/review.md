All fixes applied. Here's a summary of changes made based on your feedback:

**Changes:**

1. **`TeacherProfiles.ts`** - Changed `useAsTitle` from `label_en` to `slug` (you said "no" to using `label_en`)

2. **`src/i18n/get-locale-from-request.ts`** (new) - Extracted the duplicated `getLocaleFromRequest` function into a shared utility

3. **`teacher-profiles/route.ts`** - Uses shared locale utility, sorts by locale-appropriate field (`label_he` or `label_en`), adds `?? ''` fallback for nullable descriptions

4. **`user-settings/route.ts`** - Uses shared locale utility, adds `?? ''` fallback for nullable descriptions

5. **`teacher-profile-resolver.ts`** - Added optional `locale` parameter (defaults to `'en'`), uses a `resolveLocalizedFields` helper to return locale-appropriate labels/descriptions across all 4 tiers. Backward compatible — existing callers without locale continue to get English.

All changes pass typecheck and lint (only pre-existing warnings from unrelated files).
