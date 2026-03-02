# Content Locale — Updated Implementation Plan

## Rerun Context

This is an update of the archived `.tasks/_archive/content-locale/plan.md`. Changes from the previous version:

1. **Moved collections** to `src/server/payload/collections/` (paths corrected)
2. **Built UI i18n** (`src/i18n/config.ts`, `src/ui/web/providers/I18n/`, middleware, translation JSONs) — already done, NOT part of this plan
3. **System language ≠ Content locale** — these are now explicitly two independent concepts:
   - **System language** = UI i18n (`NEXT_LOCALE` cookie, LanguageSwitcher) — NO CHANGES
   - **Content locale** = `locale` field on documents — NEW, independent module
4. **Content locale config is independent** — does NOT import from `src/i18n/config.ts`. Own module at `src/server/payload/fields/contentLocale.ts` with its own constant `CONTENT_LOCALES`
5. **Header/Footer** variant selection uses **system language** (from I18nProvider), not content locale
6. **Conversation `preferredLocale`** is derived from **Course.locale**, not from the UI language cookie
7. **Default content locale** is `'he'` (Hebrew) for backward compatibility with all existing content
8. **Forms collection** does not exist — removed from scope

---

## Scope

Add a `locale` field to user-facing content collections so content can exist in multiple languages. Content locale is **independent** of system/UI language.

### What This Plan IS

- An independent `CONTENT_LOCALES` constant (not imported from i18n)
- A required `locale` field on publishable content (Courses, Pages, Posts, Categories)
- A `preferredLocale` field on Conversations (drives AI response language, derived from Course locale)
- `promptKey` + `locale` on Prompts for deterministic locale-aware prompt resolution
- Uniqueness enforcement hooks for `(slug, locale)` and `(promptKey, locale)`
- Header/Footer refactored to per-locale variants (variant selected by **system language**)
- Locale-aware query helpers (accept explicit locale, never infer from UI cookie)
- Backfill script for existing data (default: `'he'`)
- Course tree isolation validation

### What This Plan IS NOT

- Any changes to existing UI i18n (LanguageSwitcher, I18nProvider, middleware, NEXT_LOCALE cookie)
- Automatic translation
- Per-field multilingual content
- Changes to Chapters/Lessons/Exercises (they inherit locale from Course)
- Changes to Users, Media, UserProgress, etc.

---

## References

- **Spec**: `.tasks/content-locale/spec.md`
- **Archived PRD**: `.tasks/_archive/content-locale/prd.md`
- **Archived HLS**: `.tasks/_archive/content-locale/hls.md`
- **Archived GAP**: `.tasks/_archive/content-locale/gap.md`
- **Existing UI i18n**: `src/i18n/config.ts` (system language — NOT to be modified or imported)

---

## Assumptions

1. Content locale values happen to be the same as UI locale values (`['en', 'he']`) but are defined independently. They may diverge in the future (e.g., content in Arabic without full UI translation).
2. Default content locale is `'he'` (Hebrew) for backward compatibility — all existing content is Hebrew.
3. MongoDB compound uniqueness is enforced via hooks, not native indexes.
4. Header/Footer variant selection is driven by system language (the existing `useLocale()` from I18nProvider), since nav items are UI chrome.
5. Integration tests use the existing pattern from `tests/int/*.int.spec.ts` with real Payload + MongoDB.

---

## Phase 1: Content Locale Config & Reusable Field

> ~15 min | Infrastructure shared by all later phases

### Step 1.1: Create Content Locale Shared Config

**Files to Touch**:
- `src/server/payload/fields/contentLocale.ts` (NEW)

**Behavior**:
- Define `CONTENT_LOCALES = ['en', 'he'] as const` — **independent** of `src/i18n/config.ts`
- Export `ContentLocale` type
- Export `DEFAULT_CONTENT_LOCALE: ContentLocale = 'he'`
- Export `isValidContentLocale(value: string): boolean`
- Export `contentLocaleField`: a reusable Payload field config object:
  ```
  {
    name: 'locale',
    type: 'select',
    required: true,
    options: CONTENT_LOCALES.map(l => ({ label: l.toUpperCase(), value: l })),
    index: true,
    defaultValue: DEFAULT_CONTENT_LOCALE,
    admin: { position: 'sidebar', description: 'Content language' },
  }
  ```

**Why independent from i18n?**: Content locales and UI locales serve different purposes. Today they're the same (`['en', 'he']`), but they may diverge (e.g., adding Arabic content before the UI is translated to Arabic). Coupling them would create unwanted dependencies.

**Tests** (FAIL before, PASS after):
- `tests/unit/server/payload/fields/contentLocale.test.ts`
  1. `isValidContentLocale('he')` returns `true`; `isValidContentLocale('zz')` returns `false`
  2. `contentLocaleField` has `required: true`, `index: true`, `defaultValue: 'he'`
  3. Module does NOT import from `src/i18n/config.ts` (verify import paths)

**Acceptance**:
- [ ] `isValidContentLocale` validates against the content locale list
- [ ] `contentLocaleField` is a valid Payload field config (type='select', required, indexed, default='he')
- [ ] No imports from `src/i18n/config.ts` or `src/ui/web/providers/I18n`

---

## Phase 2: Add `locale` Field to Collections

> ~30 min | Schema changes only, no logic changes

### Step 2.1: Add `locale` to Courses

**Files to Touch**:
- `src/server/payload/collections/Courses.ts` (MODIFIED — add field + update defaultColumns)

**Behavior**:
- Import `contentLocaleField` from Step 1.1
- Add `contentLocaleField` to the `fields` array
- Add `'locale'` to `admin.defaultColumns`

**Tests**:
- `tests/int/content-locale/collections.int.spec.ts`
  1. Creating a Course without explicit locale → `locale` defaults to `'he'`
  2. Creating a Course with `locale: 'en'` → persists correctly
  3. Creating a Course with `locale: 'zz'` → fails validation

### Step 2.2: Add `locale` to Pages

**Files to Touch**:
- `src/server/payload/collections/Pages/index.ts` (MODIFIED)

**Behavior**: Same pattern as Courses — add `contentLocaleField`, update `defaultColumns`.

**Tests** (same test file):
  4. Creating a Page without locale → defaults to `'he'`
  5. Creating a Page with `locale: 'en'` → persists

### Step 2.3: Add `locale` to Posts

**Files to Touch**:
- `src/server/payload/collections/Posts/index.ts` (MODIFIED)

**Behavior**: Same pattern.

**Tests** (same test file):
  6. Creating a Post without locale → defaults to `'he'`

### Step 2.4: Add `locale` to Categories

**Files to Touch**:
- `src/server/payload/collections/Categories.ts` (MODIFIED)

**Behavior**: Same pattern.

**Tests** (same test file):
  7. Creating a Category without locale → defaults to `'he'`

### Step 2.5: Run type generation

After all schema changes:
```bash
pnpm generate:types
pnpm generate:importmap
```

**Acceptance for Phase 2**:
- [ ] All four collections have a required, indexed `locale` field
- [ ] Default value is `'he'` for all
- [ ] `payload-types.ts` includes `locale` on Course, Page, Post, Category types
- [ ] `tsc --noEmit` passes

---

## Phase 3: Prompts — `promptKey` + Locale Variant Model

> ~20 min

### Step 3.1: Add `locale` and rename `key` to `promptKey` on Prompts

**Files to Touch**:
- `src/server/payload/collections/Prompts.ts` (MODIFIED)

**Behavior**:
- Rename the `key` field to `promptKey` (update `name`, `admin.description`)
- Remove `unique: true` from `promptKey` (uniqueness is now per `(promptKey, locale)`, enforced by hook)
- Add `contentLocaleField` to fields
- Update `admin.defaultColumns` to `['title', 'promptKey', 'locale', 'type', 'status', 'usage', 'tenant', 'updatedAt']`

**Tests**:
- `tests/int/content-locale/prompts.int.spec.ts`
  1. Creating a Prompt with `promptKey: 'tutor-v1'`, `locale: 'he'` succeeds
  2. Creating a Prompt with `promptKey: 'tutor-v1'`, `locale: 'en'` succeeds (different locale = OK)
  3. Prompt without locale → defaults to `'he'`

### Step 3.2: Update prompt-resolver to use `(promptKey, locale)`

**Files to Touch**:
- `src/infra/llm/prompt-resolver.server.ts` (MODIFIED)

**Behavior**:
- Update `resolveAgentSystemPrompt` signature to accept optional `locale?: ContentLocale`
- When querying for default prompt, add `locale` filter if provided
- If no match with locale, fall back to current behavior (no locale filter) — backward compatibility
- Log a warning when falling back to locale-unaware resolution

**Tests**:
- `tests/int/content-locale/prompt-resolver.int.spec.ts`
  1. With two prompts (same promptKey, different locales): resolving with `locale: 'he'` returns the Hebrew prompt
  2. Resolving with `locale: 'en'` returns the English prompt
  3. Resolving without locale → falls back to any published default (backward compat)

**Acceptance for Phase 3**:
- [ ] Prompts have `promptKey` (not `key`) and `locale` fields
- [ ] Prompt resolver accepts locale and filters by it
- [ ] Backward compatibility: resolver works without locale param
- [ ] `tsc --noEmit` passes

---

## Phase 4: Conversations — `preferredLocale`

> ~15 min

### Step 4.1: Add `preferredLocale` to Conversations

**Files to Touch**:
- `src/server/payload/collections/Conversations.ts` (MODIFIED)

**Behavior**:
- Import `contentLocaleField` from Step 1.1
- Add a customized version: `{ ...contentLocaleField, name: 'preferredLocale', admin: { ...contentLocaleField.admin, description: 'Primary language for AI responses (derived from Course locale)' } }`
- Add `'preferredLocale'` to `admin.defaultColumns`

**Tests**:
- `tests/int/content-locale/conversations.int.spec.ts`
  1. Creating a conversation without `preferredLocale` → defaults to `'he'`
  2. Creating a conversation with `preferredLocale: 'en'` → persists correctly
  3. `getOrCreateActiveConversation` preserves locale

### Step 4.2: Update ConversationService

**Files to Touch**:
- `src/server/services/conversation-service.ts` (MODIFIED)

**Behavior**:
- Update `getOrCreateActiveConversation` to accept optional `preferredLocale` param
- When creating new conversation, include `preferredLocale` in data (default to `DEFAULT_CONTENT_LOCALE`)
- On conversation reset, carry forward `preferredLocale` from archived conversation
- Add `getConversationLocale(conversationId)` helper method
- **Important**: `preferredLocale` should be passed from the Course's `locale` field by the caller, NOT read from `NEXT_LOCALE` cookie

**Tests** (extend same test file):
  4. New conversation created via service has `preferredLocale` set
  5. After reset, new conversation preserves the `preferredLocale` from old one
  6. Conversation created with `preferredLocale: 'en'` while system language is `'he'` → `preferredLocale === 'en'` (independent of UI lang)

**Acceptance for Phase 4**:
- [ ] Conversations have `preferredLocale` field
- [ ] Service passes locale through create/reset flows
- [ ] `preferredLocale` is independent of system language
- [ ] `tsc --noEmit` passes

---

## Phase 5: Uniqueness Enforcement Hooks

> ~20 min

### Step 5.1: Create uniqueness validation hook factory

**Files to Touch**:
- `src/server/payload/hooks/validateLocaleUniqueness.ts` (NEW)

**Behavior**:
- Export `enforceSlugLocaleUniqueness(collectionSlug: string)` — a `beforeChange` hook factory
  - On create/update: queries for existing doc with same `(slug, locale)` (excluding self on update)
  - Throws `APIError` with descriptive message if conflict found
  - Passes `req` for transaction safety
- Export `enforcePromptKeyLocaleUniqueness()` — same but for `(promptKey, locale)` on Prompts

**Tests**:
- `tests/int/content-locale/uniqueness.int.spec.ts`
  1. Course with `slug: 'math', locale: 'he'` → creating another `slug: 'math', locale: 'he'` → fails
  2. Course with `slug: 'math', locale: 'he'` + `slug: 'math', locale: 'en'` → succeeds (different locale)
  3. Prompt with `promptKey: 'tutor', locale: 'he'` → duplicate fails
  4. Prompt with `promptKey: 'tutor', locale: 'he'` + `promptKey: 'tutor', locale: 'en'` → succeeds

### Step 5.2: Apply hooks to collections

**Files to Touch**:
- `src/server/payload/collections/Courses.ts` (MODIFIED — add `beforeChange` hook)
- `src/server/payload/collections/Pages/index.ts` (MODIFIED)
- `src/server/payload/collections/Posts/index.ts` (MODIFIED)
- `src/server/payload/collections/Categories.ts` (MODIFIED)
- `src/server/payload/collections/Prompts.ts` (MODIFIED)

**Behavior**:
- Add `enforceSlugLocaleUniqueness('courses')` to Courses `beforeChange` (append to existing hooks array)
- Same for Pages (`'pages'`), Posts (`'posts'`), Categories (`'categories'`)
- Add `enforcePromptKeyLocaleUniqueness()` to Prompts `beforeChange`

**Note**: Courses already has a `beforeChange` hook array — append to it, don't replace.

**Acceptance for Phase 5**:
- [ ] Duplicate `(slug, locale)` is rejected for all four collections
- [ ] Duplicate `(promptKey, locale)` is rejected for Prompts
- [ ] Different locale with same slug is allowed
- [ ] Update to self does not trigger false conflict

---

## Phase 6: Header/Footer Locale Variants

> ~20 min

### Step 6.1: Refactor Header global to variants array

**Files to Touch**:
- `src/ui/web/header/config.ts` (MODIFIED)

**Behavior**:
- Change from flat `navItems` array to a `variants` array:
  ```
  variants: [
    { locale: 'he', navItems: [...] },
    { locale: 'en', navItems: [...] },
  ]
  ```
- Each variant has a `locale` select field + the existing `navItems` array
- Keep existing access control and hooks

### Step 6.2: Refactor Footer global to variants array

**Files to Touch**:
- `src/ui/web/footer/config.ts` (MODIFIED)

**Behavior**: Same pattern as Header.

### Step 6.3: Update Header/Footer rendering components

**Files to Touch**:
- `src/ui/web/header/Component.tsx` (MODIFIED)
- `src/ui/web/footer/Component.tsx` (MODIFIED)

**Behavior**:
- Read locale from `useLocale()` — this is the **system language** from I18nProvider (the `NEXT_LOCALE` cookie)
- Filter `variants` array to find matching system language variant
- Fall back to first variant if no match
- **Important**: This uses system language (UI locale), NOT content locale. Header/Footer are UI chrome.

**Tests**:
- `tests/int/content-locale/globals.int.spec.ts`
  1. Header global with two variants → fetching variant for `'he'` returns Hebrew nav items
  2. Footer global with two variants → fetching variant for `'en'` returns English nav items
  3. Missing locale variant → falls back to first variant

**Acceptance for Phase 6**:
- [ ] Header/Footer store per-locale variants
- [ ] Components render the correct variant based on **system language** (not content locale)
- [ ] Backward compatible: single-variant config still works

---

## Phase 7: Locale-Aware Query Helpers

> ~20 min

### Step 7.1: Create locale-aware query helpers

**Files to Touch**:
- `src/server/services/locale-queries.ts` (NEW)

**Behavior**:
- Export helper functions that wrap `payload.find()` with mandatory content locale filtering:
  - `findCoursesByLocale(payload, locale, options?)` — adds `locale: { equals }` to where clause
  - `findPagesByLocale(payload, locale, options?)`
  - `findPostsByLocale(payload, locale, options?)`
  - `getHeaderVariant(payload, locale)` — fetches header global, returns matching variant
  - `getFooterVariant(payload, locale)` — fetches footer global, returns matching variant
- Each helper throws `Error('Content locale is required for content queries')` if locale is missing/empty
- In development (`NODE_ENV !== 'production'`), throws hard error; in production, logs warning + uses `DEFAULT_CONTENT_LOCALE`
- **Important**: These helpers accept explicit `locale` parameter. They do NOT read from cookies or headers.

**Tests**:
- `tests/int/content-locale/locale-queries.int.spec.ts`
  1. `findCoursesByLocale(payload, 'he')` returns only Hebrew courses
  2. `findCoursesByLocale(payload, 'en')` returns only English courses
  3. `findCoursesByLocale(payload, '')` throws error
  4. `findCoursesByLocale(payload, undefined)` throws error

### Step 7.2: Create content locale resolution

**Files to Touch**:
- `src/server/services/content-locale-context.ts` (NEW)

**Behavior**:
- Export `resolveContentLocale(sources: { explicit?, courseLocale?, defaultLocale? })` function
- Resolution order: explicit param → course locale → default (`'he'`)
- Returns `{ locale: ContentLocale, source: string }` for traceability
- **Does NOT read from `NEXT_LOCALE` cookie** — that's system language, not content locale
- This is used when code needs to determine which content locale to use (e.g., which prompt variant)

**Tests**:
- `tests/unit/server/services/content-locale-context.test.ts`
  1. Explicit param `'en'` → returns `{ locale: 'en', source: 'explicit' }`
  2. No explicit, courseLocale `'he'` → returns `{ locale: 'he', source: 'course' }`
  3. Nothing provided → returns `{ locale: 'he', source: 'default' }`
  4. Invalid locale `'zz'` → returns default

**Acceptance for Phase 7**:
- [ ] Query helpers enforce content locale filter
- [ ] Missing locale throws in dev
- [ ] Content locale resolution does NOT depend on UI language / NEXT_LOCALE cookie
- [ ] `tsc --noEmit` passes

---

## Phase 8: Course Tree Isolation Validation

> ~25 min

### Step 8.1: Create course tree isolation service

**Files to Touch**:
- `src/server/services/course-tree-isolation.ts` (NEW)

**Behavior**:
- Export `validateCourseTreeIsolation(payload, courseId): Promise<{ valid: boolean, errors: string[] }>`
  - Fetches all chapters → verifies each references this course
  - Fetches all lessons for those chapters → verifies each references a chapter of this course
  - Fetches all exercises for those lessons → verifies each references a lesson of this course
  - Returns errors array describing any "escaping" references
- Export `getCourseLocale(payload, courseId): Promise<ContentLocale>`
  - Simple helper: fetch course, return its locale

### Step 8.2: Create publish-time validation hook

**Files to Touch**:
- `src/server/payload/hooks/courses/validateTreeIsolation.ts` (NEW)
- `src/server/payload/collections/Courses.ts` (MODIFIED — add `beforeChange` hook)

**Behavior**:
- Hook runs on `beforeChange` when `status` changes to `'published'`
- Calls `validateCourseTreeIsolation`
- If validation fails, throws `APIError` with details
- Skip if status is not changing to published (draft saves are OK)

**Tests**:
- `tests/int/content-locale/course-isolation.int.spec.ts`
  1. Course with chapters all referencing it → publish succeeds
  2. Course with a chapter referencing a different course → publish fails with descriptive error
  3. Draft save with isolation violation → still succeeds (only enforced on publish)

**Acceptance for Phase 8**:
- [ ] Publishing a course validates tree isolation
- [ ] Violations produce clear error messages
- [ ] Draft saves are not blocked

---

## Phase 9: Backfill Migration Script

> ~15 min

### Step 9.1: Create backfill script

**Files to Touch**:
- `scripts/backfill-content-locale.ts` (NEW)

**Behavior**:
- Connect to Payload
- For each collection (Courses, Pages, Posts, Categories):
  - Find all docs where `locale` is missing/null
  - Update each to `locale: 'he'` (DEFAULT_CONTENT_LOCALE — backward compat)
  - Log count of updated docs
- For Conversations:
  - Find all docs where `preferredLocale` is missing/null
  - Update each to `preferredLocale: 'he'`
- For Prompts:
  - Find all docs where `locale` is missing/null
  - Set `locale: 'he'`
  - Copy `key` value to `promptKey` if `promptKey` is missing
- For Header/Footer globals:
  - Read current data
  - Wrap existing `navItems` into `variants: [{ locale: 'he', navItems: existingNavItems }]`
- Output summary of all changes

**Tests**:
- `tests/int/content-locale/backfill.int.spec.ts`
  1. Create a course without locale → run backfill → course now has `locale: 'he'`
  2. Create a prompt with `key: 'abc'` and no `promptKey` → run backfill → `promptKey: 'abc'`
  3. Idempotency: running backfill twice produces same result

**Acceptance for Phase 9**:
- [ ] Script updates all existing docs to have locale `'he'`
- [ ] Script is idempotent (safe to run multiple times)
- [ ] Script logs a summary

---

## Phase 10: Type Generation & Final Validation

> ~10 min

### Step 10.1: Generate types and validate

**Commands**:
```bash
pnpm generate:types
pnpm generate:importmap
pnpm -s tsc --noEmit
pnpm -s lint
```

**Acceptance**:
- [ ] `payload-types.ts` includes `locale` on Course, Page, Post, Category
- [ ] `payload-types.ts` includes `promptKey` + `locale` on Prompt
- [ ] `payload-types.ts` includes `preferredLocale` on Conversation
- [ ] `payload-types.ts` includes `variants` on Header and Footer
- [ ] TypeScript compilation passes
- [ ] Lint passes
- [ ] Content locale module has zero imports from `src/i18n/` or `src/ui/web/providers/I18n`

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `src/server/payload/fields/contentLocale.ts` | Independent content locale field + helpers (NOT coupled to UI i18n) |
| `src/server/payload/hooks/validateLocaleUniqueness.ts` | Uniqueness hooks for (slug/promptKey, locale) |
| `src/server/payload/hooks/courses/validateTreeIsolation.ts` | Publish-time course tree isolation |
| `src/server/services/course-tree-isolation.ts` | Course tree isolation validation logic |
| `src/server/services/locale-queries.ts` | Locale-aware query helpers (explicit locale, no cookie inference) |
| `src/server/services/content-locale-context.ts` | Content locale resolution (independent of UI language) |
| `scripts/backfill-content-locale.ts` | Data migration script (default: 'he') |
| `tests/int/content-locale/collections.int.spec.ts` | Collection locale field tests |
| `tests/int/content-locale/prompts.int.spec.ts` | Prompt locale variant tests |
| `tests/int/content-locale/conversations.int.spec.ts` | Conversation locale tests |
| `tests/int/content-locale/uniqueness.int.spec.ts` | Uniqueness enforcement tests |
| `tests/int/content-locale/globals.int.spec.ts` | Header/Footer variant tests |
| `tests/int/content-locale/locale-queries.int.spec.ts` | Query helper tests |
| `tests/int/content-locale/course-isolation.int.spec.ts` | Tree isolation tests |
| `tests/int/content-locale/backfill.int.spec.ts` | Migration script tests |
| `tests/unit/server/payload/fields/contentLocale.test.ts` | Unit tests for content locale config |
| `tests/unit/server/services/content-locale-context.test.ts` | Unit tests for content locale resolution |

### Modified Files

| File | Changes |
|------|---------|
| `src/server/payload/collections/Courses.ts` | Add `locale` field, uniqueness hook, isolation hook |
| `src/server/payload/collections/Pages/index.ts` | Add `locale` field, uniqueness hook |
| `src/server/payload/collections/Posts/index.ts` | Add `locale` field, uniqueness hook |
| `src/server/payload/collections/Categories.ts` | Add `locale` field, uniqueness hook |
| `src/server/payload/collections/Prompts.ts` | Rename `key`→`promptKey`, add `locale`, uniqueness hook |
| `src/server/payload/collections/Conversations.ts` | Add `preferredLocale` field |
| `src/server/services/conversation-service.ts` | Accept/pass `preferredLocale` in create/reset (from Course locale, not UI lang) |
| `src/infra/llm/prompt-resolver.server.ts` | Accept optional `locale`, filter by it |
| `src/ui/web/header/config.ts` | Refactor to variants array |
| `src/ui/web/footer/config.ts` | Refactor to variants array |
| `src/ui/web/header/Component.tsx` | Read **system language** (useLocale), select variant |
| `src/ui/web/footer/Component.tsx` | Read **system language** (useLocale), select variant |

### Files NOT Modified (Explicit)

| File | Why |
|------|-----|
| `src/i18n/config.ts` | System language config — independent of content locale |
| `src/ui/web/providers/I18n/index.tsx` | UI i18n provider — no changes |
| `src/ui/web/LanguageSwitcher/index.tsx` | Switches system language only — no changes |
| `middleware.ts` | Handles NEXT_LOCALE cookie for UI — no changes |
| `src/i18n/en.json`, `src/i18n/he.json` | UI translation strings — no changes |

---

## Implementation Order & Dependencies

```
Phase 1 (content locale config — independent module)
  ↓
Phase 2 (collections) ──→ Phase 5 (uniqueness hooks)
  ↓
Phase 3 (prompts)
  ↓
Phase 4 (conversations — preferredLocale from Course.locale)
  ↓
Phase 6 (header/footer — variant by system language)
  ↓
Phase 7 (query helpers — explicit locale, no cookie inference)
  ↓
Phase 8 (course isolation)
  ↓
Phase 9 (backfill — default 'he')
  ↓
Phase 10 (validation)
```

Phases 2-4 can be done in parallel after Phase 1. Phase 5 depends on Phase 2. Phases 6-8 can be done in parallel after Phase 5. Phase 9 depends on all schema changes. Phase 10 is always last.

---

## Non-Goals (Explicit)

- No changes to existing UI i18n (LanguageSwitcher, I18nProvider, middleware, NEXT_LOCALE cookie)
- No coupling between system language cookie and content locale field
- No automatic translation
- No per-field dynamic language switching
- No fine-grained multilingual content inside learning units
- No separate HeaderEn/HeaderHe globals (use variants array instead)
- No mixed-locale LMS trees
- No locale on Chapters/Lessons/Exercises (inherit from Course)
- No Forms collection changes (collection doesn't exist)
- No localized Media metadata (deferred)
