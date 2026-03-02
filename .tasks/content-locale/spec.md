# Task: Content Locale Support

## 1. Scope

```yaml
Feature: Content-level locale field for multilingual content management
Type: feature
Impact: high
Dependencies: Existing UI i18n system (src/i18n/config.ts), Payload collections, prompt resolver
Kill Switch: None (schema addition, backward compatible with backfill)
```

**Goal**: Add a required `locale` field to user-facing publishable content so the platform can host content in multiple languages (e.g., a Hebrew math course and an English math course as separate documents). Enforce single-language LMS course trees and locale-aware prompt resolution.

**Hard Boundary**:

- **IN SCOPE**: Courses, Pages, Posts, Categories, Prompts, Conversations, Header/Footer globals, prompt resolver, conversation service, query helpers, backfill script, separation of system language from content locale
- **OUT OF SCOPE**: Chapters, Lessons, Exercises (inherit locale from Course), Users, Media, UserProgress, Tenants, admin panel UI beyond field display, automatic translation

---

## Key Architectural Principle: System Language ≠ Content Locale

These are **two independent selections**:

| Concept | What it controls | Where it's stored | Who sets it | Example |
|---------|-----------------|-------------------|-------------|---------|
| **System Language** (UI i18n) | Button labels, menu text, error messages, navigation chrome | `NEXT_LOCALE` cookie (existing) | User via LanguageSwitcher | "Log in" vs "התחבר" |
| **Content Locale** | Which language a Course/Page/Post is written in; which prompt variant the AI uses; what language the AI responds in | `locale` field on each document; `preferredLocale` on Conversations | Admin when creating content; derived from Course locale for chat | Course titled "מתמטיקה כיתה ח" has `locale: 'he'` |

**Why they must be separate**:
- A user may browse the site in English (system lang = `en`) but study a Hebrew math course (content locale = `he`)
- An admin may use the English interface to manage Hebrew content
- AI chat language is driven by content locale (course locale), not by which language the menus are in
- Header/Footer navigation is driven by system language, not content locale

**Current state**: The `LanguageSwitcher` sets one `NEXT_LOCALE` cookie that drives both UI translations AND (implicitly) which content the user sees. This task separates them.

**After this task**:
- `NEXT_LOCALE` cookie → drives system language (UI i18n) only — **no changes needed** to existing i18n
- `locale` field on content → drives which content is served; resolved from content itself, not from UI language
- `preferredLocale` on Conversations → drives AI response language; derived from Course locale when conversation is created
- Header/Footer → driven by **system language** (the `NEXT_LOCALE` / UI locale), since nav items are part of UI chrome
- Query helpers for content → accept explicit `locale` parameter, never infer from UI language automatically

**Default content locale**: `'he'` (Hebrew) — for backward compatibility with all existing content.

---

## 2. Behaviors to Cover

### Stage 1: Content Locale Config

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-1  | Should export reusable `contentLocaleField` Payload field config      | Happy      |
| CL-2  | Should define `CONTENT_LOCALES` as `['en', 'he']` (same values as UI locales but independent constant) | Happy |
| CL-3  | Should export `isValidContentLocale()` that validates locale strings  | Validation |
| CL-4  | Should export `DEFAULT_CONTENT_LOCALE` as `'he'` (Hebrew, for backward compat) | Happy |
| CL-5  | Content locale config should be independent of UI i18n config (separate module) | Architecture |

### Stage 2: Collection Schema — Locale Field

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-6  | Courses should have required, indexed `locale` field                  | Happy      |
| CL-7  | Courses `locale` should default to `'he'`                             | Happy      |
| CL-8  | Courses should reject invalid locale values                           | Validation |
| CL-9  | Pages should have required, indexed `locale` field                    | Happy      |
| CL-10 | Posts should have required, indexed `locale` field                    | Happy      |
| CL-11 | Categories should have required, indexed `locale` field               | Happy      |
| CL-12 | All collections should show `locale` in admin default columns         | Happy      |

### Stage 3: Prompts — Locale Variant Model

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-13 | Prompts should have `promptKey` field (renamed from `key`)            | Migration  |
| CL-14 | Prompts should have required, indexed `locale` field                  | Happy      |
| CL-15 | Same `promptKey` with different locales should be allowed             | Happy      |
| CL-16 | Prompt resolver should accept optional `locale` parameter             | Happy      |
| CL-17 | Prompt resolver with locale should filter by `(promptKey, locale)`    | Happy      |
| CL-18 | Prompt resolver without locale should fall back (backward compat)     | Backward   |
| CL-19 | Prompt resolver should log warning on locale-unaware fallback         | Observability |

### Stage 4: Conversations — Preferred Locale

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-20 | Conversations should have `preferredLocale` field (required, indexed) | Happy      |
| CL-21 | Conversations `preferredLocale` should default to `'he'`              | Happy      |
| CL-22 | ConversationService.getOrCreate should accept `preferredLocale` param | Happy      |
| CL-23 | ConversationService.getOrCreate should set locale on new conversations| Happy      |
| CL-24 | ConversationService.resetConversation should carry forward locale     | Happy      |
| CL-25 | `preferredLocale` should be derived from Course locale, not from UI language | Architecture |

### Stage 5: Uniqueness Enforcement

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-26 | Duplicate `(slug, locale)` on Courses should be rejected              | Validation |
| CL-27 | Same slug with different locale on Courses should be allowed          | Happy      |
| CL-28 | Duplicate `(slug, locale)` on Pages should be rejected                | Validation |
| CL-29 | Duplicate `(slug, locale)` on Posts should be rejected                | Validation |
| CL-30 | Duplicate `(slug, locale)` on Categories should be rejected           | Validation |
| CL-31 | Duplicate `(promptKey, locale)` on Prompts should be rejected         | Validation |
| CL-32 | Same `promptKey` with different locale on Prompts should be allowed   | Happy      |
| CL-33 | Update to self should not trigger uniqueness conflict                  | Edge       |

### Stage 6: Header/Footer Locale Variants

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-34 | Header global should store per-locale nav item variants               | Happy      |
| CL-35 | Footer global should store per-locale nav item variants               | Happy      |
| CL-36 | Header component should render variant matching **system language** (not content locale) | Happy |
| CL-37 | Footer component should render variant matching **system language** (not content locale) | Happy |
| CL-38 | Missing locale variant should fall back to first variant              | Edge       |

### Stage 7: Locale-Aware Query Helpers

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-39 | `findCoursesByLocale(payload, 'he')` should return only Hebrew courses| Happy      |
| CL-40 | `findCoursesByLocale(payload, 'en')` should return only English courses| Happy     |
| CL-41 | Query helpers should throw if locale is empty/missing (dev mode)      | Validation |
| CL-42 | Content locale resolver should accept explicit locale param (not infer from UI) | Architecture |
| CL-43 | Content locale resolver should reject invalid locales gracefully      | Validation |

### Stage 8: Course Tree Isolation

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-44 | Publishing course should validate all chapters reference this course  | Validation |
| CL-45 | Publishing course with cross-referenced chapter should fail           | Validation |
| CL-46 | Draft save with isolation violation should still succeed               | Edge       |

### Stage 9: Backfill Migration

| ID    | Behavior                                                              | Category   |
|-------|-----------------------------------------------------------------------|------------|
| CL-47 | Backfill should set `locale: 'he'` on all Courses without locale      | Migration  |
| CL-48 | Backfill should set `locale: 'he'` on all Pages/Posts/Categories      | Migration  |
| CL-49 | Backfill should set `preferredLocale: 'he'` on all Conversations      | Migration  |
| CL-50 | Backfill should copy `key` to `promptKey` on Prompts if missing       | Migration  |
| CL-51 | Backfill should wrap Header/Footer navItems into variants array       | Migration  |
| CL-52 | Backfill should be idempotent (safe to run multiple times)            | Edge       |

---

## 3. Expected Outcomes

### Content Locale Config (Stage 1)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-1     | `contentLocaleField` is a valid Payload field config with `type: 'select'`, `required: true`, `index: true` |
| CL-2     | `CONTENT_LOCALES` is `['en', 'he']` — same values as UI locales but defined in its own module |
| CL-3     | `isValidContentLocale('he')` → `true`; `isValidContentLocale('zz')` → `false` |
| CL-4     | `DEFAULT_CONTENT_LOCALE === 'he'` |
| CL-5     | `contentLocaleField` is importable from `src/server/payload/fields/contentLocale.ts` without importing any UI i18n code |

### Collection Schema (Stage 2)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-6     | `payload.create({ collection: 'courses', data: { ...minFields } })` → doc has `locale` field |
| CL-7     | Course created without explicit locale → `doc.locale === 'he'` |
| CL-8     | Course created with `locale: 'zz'` → validation error thrown |
| CL-9-11  | Same as CL-6/7 for Pages, Posts, Categories respectively |
| CL-12    | Admin UI shows `locale` column in list views for all four collections |

### Prompts (Stage 3)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-13    | Prompts collection uses `promptKey` (not `key`) as the machine-readable identifier field |
| CL-14    | Prompt created without locale → `doc.locale === 'he'` |
| CL-15    | Two prompts with `promptKey: 'tutor-v1'` but different locales → both persist without error |
| CL-16    | `resolveAgentSystemPrompt(payload, null, 'he')` signature accepted |
| CL-17    | With 'he' and 'en' prompts: resolving with `'he'` returns Hebrew prompt template |
| CL-18    | `resolveAgentSystemPrompt(payload, null)` (no locale) → still returns a prompt (backward compat) |
| CL-19    | When falling back to locale-unaware query, a warning is logged |

### Conversations (Stage 4)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-20    | Conversation document has `preferredLocale` field in DB |
| CL-21    | Conversation created without `preferredLocale` → `doc.preferredLocale === 'he'` |
| CL-22    | `service.getOrCreateActiveConversation(userId, ctx, key, req, 'en')` → accepted |
| CL-23    | New conversation via service has `preferredLocale` matching passed value |
| CL-24    | After `resetConversation`, new conversation has same `preferredLocale` as archived one |
| CL-25    | When chat is initiated from a Course page, `preferredLocale` is set to Course's `locale`, not the UI language |

### Uniqueness (Stage 5)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-26    | Second course with `slug: 'math', locale: 'he'` → `APIError` thrown |
| CL-27    | Course `slug: 'math', locale: 'en'` alongside `slug: 'math', locale: 'he'` → succeeds |
| CL-28-30 | Same uniqueness enforcement for Pages, Posts, Categories |
| CL-31    | Second prompt with `promptKey: 'tutor', locale: 'he'` → error |
| CL-32    | Prompt `promptKey: 'tutor', locale: 'en'` alongside `'he'` → succeeds |
| CL-33    | Updating a course's title (same slug, same locale) → no false conflict |

### Header/Footer (Stage 6)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-34    | `payload.findGlobal({ slug: 'header' })` returns `{ variants: [{ locale: 'he', navItems: [...] }, ...] }` |
| CL-35    | Same for `footer` global |
| CL-36    | With **system language** `'he'`, Header component renders Hebrew nav items |
| CL-37    | With **system language** `'en'`, Footer component renders English nav items |
| CL-38    | With system language `'zz'` (no variant), component renders first variant's nav items |

### Query Helpers (Stage 7)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-39    | With 2 courses (he + en): `findCoursesByLocale(payload, 'he')` → returns only Hebrew course |
| CL-40    | `findCoursesByLocale(payload, 'en')` → returns only English course |
| CL-41    | `findCoursesByLocale(payload, '')` → throws `Error('Content locale is required...')` |
| CL-42    | `resolveContentLocale({ explicit: 'en' })` → `{ locale: 'en', source: 'explicit' }` (does NOT read from NEXT_LOCALE cookie) |
| CL-43    | `resolveContentLocale({ explicit: 'zz' })` → `{ locale: 'he', source: 'default' }` |

### Course Tree Isolation (Stage 8)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-44    | Course with all chapters pointing to it → status change to `'published'` succeeds |
| CL-45    | Course with orphan chapter (points to different course) → publish blocked with `APIError` |
| CL-46    | Course with orphan chapter saved as `'draft'` → save succeeds |

### Backfill (Stage 9)

| Behavior | Observable Outcome |
|----------|--------------------|
| CL-47    | Course without `locale` → after backfill: `locale === 'he'` |
| CL-48    | Page/Post/Category without `locale` → after backfill: `locale === 'he'` |
| CL-49    | Conversation without `preferredLocale` → after backfill: `preferredLocale === 'he'` |
| CL-50    | Prompt with `key: 'abc'` and no `promptKey` → after backfill: `promptKey === 'abc'` |
| CL-51    | Header with flat `navItems` → after backfill: `variants: [{ locale: 'he', navItems: [...] }]` |
| CL-52    | Running backfill twice → no duplicate updates, same final state |

---

## 4. API Contracts

### Content Locale Field (Shared)

```typescript
// Defined in: src/server/payload/fields/contentLocale.ts
// NOT imported from src/i18n/config.ts — independent module

export const CONTENT_LOCALES = ['en', 'he'] as const
export type ContentLocale = (typeof CONTENT_LOCALES)[number]
export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'he'

// Reusable Payload field added to: Courses, Pages, Posts, Categories, Prompts
{
  name: 'locale',
  type: 'select',
  required: true,
  options: [
    { label: 'EN', value: 'en' },
    { label: 'HE', value: 'he' },
  ],
  index: true,
  defaultValue: 'he',
  admin: { position: 'sidebar', description: 'Content language' },
}
```

### Conversations — preferredLocale

```typescript
// Derived from Course.locale when conversation is created from a course context
// NOT from the NEXT_LOCALE cookie / UI language
{
  name: 'preferredLocale',
  type: 'select',
  required: true,
  options: [
    { label: 'EN', value: 'en' },
    { label: 'HE', value: 'he' },
  ],
  index: true,
  defaultValue: 'he',
  admin: { position: 'sidebar', description: 'Primary language for AI responses (from Course locale)' },
}
```

### Prompts — promptKey

```typescript
// Rename from: { name: 'key', unique: true }
// To:
{
  name: 'promptKey',
  type: 'text',
  index: true,
  // unique: false — uniqueness is now per (promptKey, locale), enforced by hook
  admin: {
    description: 'Machine-readable key (e.g., "default-tutor-v1")',
    position: 'sidebar',
  },
}
```

### Header/Footer Variants

```typescript
// Current (flat):
{ name: 'navItems', type: 'array', fields: [link()] }

// New (per-locale variants):
// NOTE: Header/Footer locale = system language (UI), not content locale
{
  name: 'variants',
  type: 'array',
  fields: [
    { name: 'locale', type: 'select', options: CONTENT_LOCALES, required: true },
    { name: 'navItems', type: 'array', fields: [link()] },
  ],
}
```

### Prompt Resolver Signature

```typescript
// Current:
resolveAgentSystemPrompt(payload: Payload, lessonPrompt?: Prompt | null): Promise<PromptResolutionResult>

// New:
resolveAgentSystemPrompt(payload: Payload, lessonPrompt?: Prompt | null, locale?: ContentLocale): Promise<PromptResolutionResult>
```

### Conversation Service Signature

```typescript
// Current:
getOrCreateActiveConversation(userId, contextRef, contextKeyOverride?, req?)

// New:
getOrCreateActiveConversation(userId, contextRef, contextKeyOverride?, req?, preferredLocale?)
// preferredLocale should come from Course.locale, not UI language
```

### Query Helpers

```typescript
// New module: src/server/services/locale-queries.ts
// NOTE: locale param is explicit — never inferred from UI language cookie
findCoursesByLocale(payload: Payload, locale: ContentLocale, options?: FindArgs): Promise<PaginatedDocs<Course>>
findPagesByLocale(payload: Payload, locale: ContentLocale, options?: FindArgs): Promise<PaginatedDocs<Page>>
findPostsByLocale(payload: Payload, locale: ContentLocale, options?: FindArgs): Promise<PaginatedDocs<Post>>
getHeaderVariant(payload: Payload, locale: ContentLocale): Promise<NavItem[]>
getFooterVariant(payload: Payload, locale: ContentLocale): Promise<NavItem[]>
```

### Content Locale Context Resolver

```typescript
// New module: src/server/services/content-locale-context.ts
// IMPORTANT: This is for CONTENT locale resolution, NOT UI language
// It does NOT read NEXT_LOCALE cookie — that's for UI language only
resolveContentLocale(sources: {
  explicit?: string       // Explicit content locale param (e.g., from Course.locale)
  courseLocale?: string    // Locale of the current course context
  defaultLocale?: string  // Fallback
}): { locale: ContentLocale, source: string }
```

---

## 5. Separation of Concerns: System Language vs Content Locale

### Resolution Flow Comparison

```
SYSTEM LANGUAGE (UI i18n) — EXISTING, NO CHANGES:
  subdomain (en.example.com) → NEXT_LOCALE cookie → Accept-Language header → default ('he')
  → Used by: I18nProvider, useTranslations(), LanguageSwitcher, Header/Footer rendering

CONTENT LOCALE — NEW:
  Explicit param → Course.locale → default ('he')
  → Used by: Content queries, prompt resolution, AI response language, conversation preferredLocale
  → NEVER reads from NEXT_LOCALE cookie
```

### What Uses What

| Component / Feature | Uses System Language | Uses Content Locale |
|---------------------|---------------------|---------------------|
| Button labels, menu text | ✅ | ❌ |
| LanguageSwitcher | ✅ (sets NEXT_LOCALE) | ❌ |
| Header/Footer nav items | ✅ (variant by system lang) | ❌ |
| Course listing page | ✅ (UI text) | ✅ (filter courses by content locale) |
| Exercise renderer UI text | ✅ (labels like "Submit") | ❌ |
| Exercise content (question text) | ❌ | ✅ (inherits from Course locale) |
| AI chat response language | ❌ | ✅ (from Conversation.preferredLocale) |
| Prompt selection | ❌ | ✅ (promptKey + locale) |
| Page/Post content | ❌ | ✅ (Page/Post.locale) |

---

## 6. Error Handling

| Scenario | Response |
|----------|----------|
| Invalid locale value in collection create/update | Payload validation error (select field rejects unknown values) |
| Duplicate `(slug, locale)` | `APIError` with message: `"A document with slug '{slug}' and locale '{locale}' already exists in {collection}"` |
| Duplicate `(promptKey, locale)` | `APIError` with message: `"A prompt with key '{promptKey}' and locale '{locale}' already exists"` |
| Missing locale in content query helper (dev) | `Error('Content locale is required for content queries')` — hard throw |
| Missing locale in content query helper (prod) | Log warning, use `DEFAULT_CONTENT_LOCALE` ('he') as fallback |
| Course publish with isolation violation | `APIError` with message listing which children reference wrong course |
| Prompt resolution with locale but no match | Fall back to locale-unaware query, log warning |

---

## 7. Data Model Impact

### Collections Modified

| Collection | Field Added | Type | Required | Default | Index |
|------------|-------------|------|----------|---------|-------|
| Courses | `locale` | select | ✅ | `'he'` | ✅ |
| Pages | `locale` | select | ✅ | `'he'` | ✅ |
| Posts | `locale` | select | ✅ | `'he'` | ✅ |
| Categories | `locale` | select | ✅ | `'he'` | ✅ |
| Prompts | `locale` | select | ✅ | `'he'` | ✅ |
| Prompts | `promptKey` (rename from `key`) | text | — | — | ✅ |
| Conversations | `preferredLocale` | select | ✅ | `'he'` | ✅ |

### Globals Modified

| Global | Change |
|--------|--------|
| Header | `navItems` → `variants: [{ locale, navItems }]` — variant selected by **system language** |
| Footer | `navItems` → `variants: [{ locale, navItems }]` — variant selected by **system language** |

### Collections NOT Modified (Explicit)

Chapters, Lessons, Exercises, ExerciseAssets, Users, UserProgress, UserSettings, Media, Tenants, GuestSessions, MemoryItems, PricingPlans, MCPAuditLogs, ConfigValues, ConfigSecrets, ConfigAuditLogs, ChatAssets, UploadSessions, TeacherProfiles

### Existing UI i18n NOT Modified

- `src/i18n/config.ts` — no changes
- `src/ui/web/providers/I18n/index.tsx` — no changes
- `src/ui/web/LanguageSwitcher/index.tsx` — no changes
- `middleware.ts` — no changes
- `NEXT_LOCALE` cookie — still only controls system language

---

## 8. Stop Conditions (When to Ship)

All of the following must be true:

- [ ] All 52 behaviors (CL-1 through CL-52) pass their tests
- [ ] `pnpm -s tsc --noEmit` passes (no type errors)
- [ ] `pnpm -s lint` passes (no lint errors)
- [ ] `pnpm generate:types` produces updated `payload-types.ts` with locale fields
- [ ] `pnpm generate:importmap` succeeds
- [ ] Backfill script runs without errors on test data
- [ ] No changes to Chapters/Lessons/Exercises schemas
- [ ] Content locale module does NOT import from `src/i18n/config.ts` or `src/ui/web/providers/I18n`
- [ ] Header/Footer rendering uses system language (from I18nProvider), not content locale
- [ ] Conversation `preferredLocale` is derived from Course locale, not UI language

---

## 9. Non-Goals (Explicit)

- No automatic translation between locales
- No per-field multilingual content (e.g., `title_en` / `title_he`)
- No locale on Chapters/Lessons/Exercises (they inherit from Course)
- No mixed-locale LMS trees (one Course = one locale)
- No localized Media metadata (deferred, medium priority)
- No Forms collection changes (collection doesn't exist)
- No changes to existing UI i18n system (`src/i18n/`, LanguageSwitcher, middleware)
- No admin panel locale picker UI beyond the default select field
- No coupling between NEXT_LOCALE cookie and content locale field
