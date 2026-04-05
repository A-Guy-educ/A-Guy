Now I have a complete picture. Let me create the implementation plan.

---

## Implementation Plan: Localize Teacher Profile Selection (Hebrew/English)

### Step 1: Add localized fields to TeacherProfiles collection schema

**File:** `src/server/payload/collections/TeacherProfiles.ts`
**Change:** Replace single `label` and `description` fields with locale-aware groups: `label_en`, `label_he`, `description_en`, `description_he`. Keep original `label` and `description` as computed/display fields in admin.
**Why:** The collection currently stores only one language. Dual fields allow admin editors to enter both languages in the CMS, satisfying human feedback item #3 (separate edit fields for Hebrew and English in admin).
**Verify:** `pnpm generate:types` compiles without errors.

Schema change:

```
fields:
  - slug (unchanged)
  - label_en (text, required) — English label
  - label_he (text, required) — Hebrew label
  - description_en (textarea) — English description
  - description_he (textarea) — Hebrew description
  - systemPrompt (unchanged)
  - isEnabled (unchanged)
```

Admin `useAsTitle` should use `label_en` (or a virtual field).

---

### Step 2: Update teacher-profiles seed with dual-language content

**File:** `src/server/payload/seed/teacher-profiles-seed.ts`
**Change:** Add Hebrew translations for each profile's `label` and `description`. Update seed data structure to write `label_en`, `label_he`, `description_en`, `description_he` fields instead of `label` and `description`.
**Why:** Existing and new profiles both need localized content (feedback item #2: both migrate and new content).
**Verify:** Seed function compiles: `pnpm typecheck`

Translations for the 5 profiles:
| Slug | label_en | label_he |
|------|----------|----------|
| teacher_strict | Strict Teacher | מורה קפדן |
| teacher_thorough | Thorough Teacher | מורה יסודי |
| teacher_patient | Patient Teacher | מורה סבלני |
| teacher_focused | Focused Teacher | מורה ממוקד |
| teacher_challenging | Challenging Teacher | מורה מאתגר |

---

### Step 3: Update teacher-profiles API to accept and return localized content

**File:** `src/app/api/teacher-profiles/route.ts`
**Change:** Read locale from `x-locale` header (set by middleware). Map `label_en`/`label_he` → `label` and `description_en`/`description_he` → `description` based on locale before returning the response. This keeps the API contract unchanged for consumers.
**Why:** Frontend components already consume `label` and `description` — resolving at the API layer avoids changing every consumer.
**Verify:** `pnpm typecheck`

---

### Step 4: Update user-settings API to return localized teacher profile

**File:** `src/app/api/user-settings/route.ts`
**Change:** When returning the populated teacherProfile in GET, resolve locale from `x-locale` header and map the localized fields to `label`/`description`.
**Why:** The AccountHub's TeachersProfileSection also reads the selected profile from this endpoint.
**Verify:** `pnpm typecheck`

---

### Step 5: Write migration script for existing profiles

**File:** `src/server/payload/migrations/localize-teacher-profiles.ts` (new)
**Change:** Create a one-time migration that reads all existing `teacher_profiles` documents. For each, copy `label` → `label_en`, `description` → `description_en`, and populate `label_he`/`description_he` with Hebrew translations (same mapping as Step 2 seed data, keyed by slug).
**Why:** Existing production profiles need both language fields populated (feedback item #2).
**Verify:** Script compiles: `pnpm typecheck`

---

### Step 6: Add Hebrew translations for onboarding persona UI strings

**File:** `src/i18n/he.json`
**Change:** Verify `onboarding.persona` namespace has complete Hebrew translations. Currently present — confirm no missing keys compared to `en.json`.

**File:** `src/i18n/en.json`
**Change:** No changes needed — already has complete `onboarding.persona` section.

**Why:** UI strings are already localized; this step is verification only.
**Verify:** Compare keys between `en.json` and `he.json` for `onboarding.persona` and `auth.account.teacherProfile` namespaces.

---

### Step 7: Update TeachersProfileSection and PersonaSelectionStep (no changes expected)

**File:** `src/app/(frontend)/account/_components/TeachersProfileSection.tsx`
**File:** `src/app/(frontend)/onboarding/persona/PersonaSelectionStep.tsx`
**Change:** No frontend component changes needed. These components already consume `label` and `description` from the API response. Since Step 3 resolves localization at the API layer, the components get the correct language automatically.
**Why:** The middleware sets locale → API reads locale from header → returns localized fields. Components are locale-unaware by design.
**Verify:** Manual verification that both Hebrew and English display correctly.

---

### Step 8: Generate types and run quality gates

**Change:** Run type generation and all checks.
**Verify:**

```bash
pnpm generate:types
pnpm typecheck
pnpm lint
pnpm format:check
```

---

## Questions

1. **Admin `useAsTitle` field**: With dual-language labels, the admin list needs a title field. Recommend using `label_en` as `useAsTitle` since the admin panel is English-facing. Alternatively, a virtual `label` field could concatenate both. **Recommend `label_en` for simplicity** — approve?

2. **Migration execution strategy**: The migration script in Step 5 needs a runner. Recommend adding it as a Payload `onInit` hook with an idempotent check (skip if `label_en` already populated), similar to how seeds work. This avoids needing a separate migration framework. **Approve this approach, or prefer a standalone CLI script?**
