# Detailed Low-Level Plan: Localization & Locale Ownership Implementation

## Overview

This plan implements the locale model with **content locale owned by publishable units** only. LMS locale is owned by `Course`; children inherit implicitly. The plan uses hooks for uniqueness enforcement and centralized locale context resolution.

---

## Core Principles

1. **Content locale** (for user-facing content) is separate from **UI i18n** (interface language)
2. **LMS locale** owned by `Course` only - Chapters/Lessons/Exercises have no locale field
3. **User-facing queries MUST include locale** - missing locale = hard error in dev
4. **Prompts resolve by `(promptKey, locale)`** - deterministic, with optional explicit fallback
5. **Header/Footer** - single global with per-locale variants array
6. **Uniqueness enforced via hooks** - DB indexes for performance, hooks for validation

---

## Phase 1: Content Locale Configuration (Infrastructure)

### Step 1.1: Create Content Locale Config

**New File**: `src/lib/content-locale/config.ts`

- [ ] Export `CONTENT_LOCALES` as `['en', 'he']` const
- [ ] Export `ContentLocale` type
- [ ] Export `DEFAULT_CONTENT_LOCALE: ContentLocale = 'en'`
- [ ] Export `isValidContentLocale(locale)` function
- [ ] Export `FALLBACK_LOCALE_ORDER` (configurable, default empty)

### Step 1.2: Create Locale Context Resolution Module

**New File**: `src/lib/locale/context.ts`

- [ ] Export `LocaleContext` interface with `locale`, `source`
- [ ] Create `resolveLocale(params)` function:
  1. Explicit request param
  2. Conversation `preferredLocale`
  3. User preference (JWT)
  4. System default (`DEFAULT_CONTENT_LOCALE`)
- [ ] Export `createLocaleContext(req, params?)` function
- [ ] Export `assertLocaleContext(context)` - dev mode hard error if missing

### Step 1.3: Create Locale-Aware Query Helpers

**New File**: `src/lib/locale/queries.ts`

- [ ] Export `findCoursesByLocale(payload, locale, options)`
- [ ] Export `findPagesByLocale(payload, locale, options)`
- [ ] Export `findPostsByLocale(payload, locale, options)`
- [ ] Export `getHeaderVariant(payload, locale)`
- [ ] Export `getFooterVariant(payload, locale)`
- [ ] Export `resolvePromptByKeyAndLocale(payload, key, locale, options)`
- [ ] Each helper throws if locale missing (dev mode) or logs warning (prod)

---

## Phase 2: Collection Schema Updates (Publishable Units Only)

### Step 2.1: Update Courses Collection

**File**: `src/collections/Courses.ts`

- [ ] Add `locale` field:
  ```typescript
  {
    name: 'locale',
    type: 'select',
    required: true,
    options: CONTENT_LOCALES.map(loc => ({ label: loc.toUpperCase(), value: loc })),
    index: true,
    defaultValue: DEFAULT_CONTENT_LOCALE,
    admin: {
      description: 'Content language for this course and all derived content',
      position: 'sidebar',
    },
  }
  ```
- [ ] Update admin `defaultColumns` to include `locale`
- [ ] Add `beforeValidate` hook: auto-populate `locale` from existing if missing

### Step 2.2: Update Pages Collection

**File**: `src/collections/Pages/index.ts`

- [ ] Add `locale` field (required, indexed) - same pattern as Courses

### Step 2.3: Update Posts Collection

**File**: `src/collections/Posts/index.ts`

- [ ] Add `locale` field (required, indexed) - same pattern as Courses

### Step 2.4: Update Categories Collection

**File**: `src/collections/Categories.ts`

- [ ] Add `locale` field (required, indexed) - same pattern as Courses

### Step 2.5: Update Prompts Collection

**File**: `src/collections/Prompts.ts`

- [ ] Rename `key` → `promptKey` (stable key for resolution)
- [ ] Add `locale` field (required, indexed):
  ```typescript
  {
    name: 'locale',
    type: 'select',
    required: true,
    options: CONTENT_LOCALES,
    index: true,
    admin: { description: 'Language variant of this prompt', position: 'sidebar' },
  }
  ```
- [ ] Update admin `defaultColumns` to show `promptKey` and `locale`

### Step 2.6: Update Conversations Collection

**File**: `src/collections/Conversations.ts`

- [ ] Add `preferredLocale` field (required, indexed):
  ```typescript
  {
    name: 'preferredLocale',
    type: 'select',
    required: true,
    options: CONTENT_LOCALES,
    index: true,
    defaultValue: DEFAULT_CONTENT_LOCALE,
    admin: { description: 'Primary language for AI responses', position: 'sidebar' },
  }
  ```
- [ ] Update admin `defaultColumns` to include `preferredLocale`

### Step 2.7: Update Header Global

**File**: `src/Header/config.ts`

- [ ] Refactor to single global with variants:
  ```typescript
  {
    name: 'variants',
    type: 'array',
    fields: [
      { name: 'locale', type: 'select', options: CONTENT_LOCALES, required: true },
      { name: 'navItems', type: 'array', fields: [link(...)] },
    ],
    admin: { description: 'Localized header variants' },
  }
  ```

---

## Phase 3: Uniqueness Enforcement (Hooks + Indexes)

### Step 3.1: Create Uniqueness Validation Hooks

**New File**: `src/hooks/validate-uniqueness.ts`

- [ ] Export `enforceSlugLocaleUniqueness(collectionSlug)` hook factory
- [ ] Export `enforcePromptKeyLocaleUniqueness()` hook for Prompts
- [ ] Each hook:
  - Queries for existing doc with same (slug|promptKey, locale)
  - Throws error if conflict (create) or different doc (update)
- [ ] Hooks run in `beforeChange`

### Step 3.2: Apply Uniqueness Hooks to Collections

- [ ] Add `enforceSlugLocaleUniqueness('courses')` to Courses `beforeChange`
- [ ] Add `enforceSlugLocaleUniqueness('pages')` to Pages `beforeChange`
- [ ] Add `enforceSlugLocaleUniqueness('posts')` to Posts `beforeChange`
- [ ] Add `enforceSlugLocaleUniqueness('categories')` to Categories `beforeChange`
- [ ] Add `enforcePromptKeyLocaleUniqueness()` to Prompts `beforeChange`

### Step 3.3: Add Performance Indexes

**File**: `src/payload.config.ts`

- [ ] Add index: `Courses: { slug: 1, locale: 1 }`
- [ ] Add index: `Pages: { slug: 1, locale: 1 }`
- [ ] Add index: `Posts: { slug: 1, locale: 1 }`
- [ ] Add index: `Categories: { slug: 1, locale: 1 }`
- [ ] Add index: `Prompts: { promptKey: 1, locale: 1 }`
- [ ] Add index: `Conversations: { preferredLocale: 1 }`

---

## Phase 4: LMS Course Tree Isolation Validation

### Step 4.1: Create Course Tree Isolation Service

**New File**: `src/lib/services/course-tree-isolation.ts`

- [ ] Export `class CourseTreeIsolationService`
- [ ] Method: `validateIsolation(courseId): Promise<IsolationResult>`
  - Validates all chapters reference this course
  - Validates all lessons reference chapters of this course
  - Validates all exercises reference lessons of this course
- [ ] Method: `validateFeaturedPointers(courseId): Promise<IsolationResult>`
  - Checks no featured lesson/exercise points outside course
- [ ] Method: `getCourseLocale(courseId): Promise<ContentLocale>`

### Step 4.2: Create Validation Hook

**New File**: `src/hooks/validate-course-isolation.ts`

- [ ] Export `validateCourseTreeIsolation` hook
- [ ] Runs on Courses `beforeChange` (publish status change)
- [ ] Returns error if isolation validation fails
- [ ] Error includes details: which child escapes, which pointer escapes

### Step 4.3: Apply Isolation Hook

**File**: `src/collections/Courses.ts`

- [ ] Add `beforeChange` hook: `validateCourseTreeIsolation`
- [ ] Hook blocks publish if tree isolation fails

---

## Phase 5: Prompt Resolution with Strict Locale

### Step 5.1: Update Prompt Resolver

**File**: `src/lib/ai/prompt-resolver.server.ts`

- [ ] Update signature: `resolveAgentSystemPrompt(payload, lessonPrompt, locale, options?)`
- [ ] Options: `{ allowFallback?: boolean }`
- [ ] Default `allowFallback = false`
- [ ] Query by `(promptKey, locale)` exactly first
- [ ] If `allowFallback = true` and exact match fails:
  - Log warning with metric
  - Try fallback locales in order (if configured)
- [ ] Emit metric on fallback usage

### Step 5.2: Update Prompt Usage Sites

- [ ] Update `src/lib/ai/services/exercise-chat-service.ts` to pass `preferredLocale`
- [ ] Update `src/lib/ai/prompt-composer.server.ts`
- [ ] Pass `allowFallback: false` initially (strict mode)

---

## Phase 6: Conversation Service Update

### Step 6.1: Update Conversation Service

**File**: `src/lib/services/conversation-service.ts`

- [ ] Update `getOrCreateActiveConversation` to require `preferredLocale`
- [ ] Include `preferredLocale` in create data
- [ ] Preserve `preferredLocale` on reset
- [ ] Add helper: `getConversationLocale(conversationId)`

### Step 6.2: Update API Routes

- [ ] Update conversation creation endpoints to require locale in body
- [ ] Update chat endpoints to pass locale to AI service

### Step 6.3: Update AI Service

**File**: `src/lib/ai/services/exercise-chat-service.ts`

- [ ] Extract `preferredLocale` from conversation
- [ ] Pass locale to prompt resolver
- [ ] AI response language driven by locale

---

## Phase 7: Centralized Locale Context in Routes

### Step 7.1: Create Route Locale Middleware/Hook

**New File**: `src/lib/locale/route-context.ts`

- [ ] Export `getRouteLocale(params)` function
- [ ] Resolution order:
  1. Route segment `[locale]` if present
  2. Query param `?locale=`
  3. Cookie `NEXT_LOCALE`
  4. User JWT claim
  5. `DEFAULT_CONTENT_LOCALE`
- [ ] Returns `LocaleContext` with source tracking

### Step 7.2: Update Frontend Routes (Consistent Pattern)

- [ ] Update course routes: pass resolved locale to query helpers
- [ ] Update CMS page routes: pass resolved locale to query helpers
- [ ] Update blog routes: pass resolved locale to query helpers
- [ ] NOT every route needs locale segment - use centralized resolution

### Step 7.3: Update Header/Footer Rendering

- [ ] Update header component to call `getHeaderVariant(locale)`
- [ ] Update footer component to call `getFooterVariant(locale)`

---

## Phase 8: Backfill & Migration

### Step 8.1: Create Backfill Script

**New File**: `scripts/backfill-locale.ts`

- [ ] Query all Courses without locale → set to `DEFAULT_CONTENT_LOCALE`
- [ ] Query all Pages without locale → set to `DEFAULT_CONTENT_LOCALE`
- [ ] Query all Posts without locale → set to `DEFAULT_CONTENT_LOCALE`
- [ ] Query all Categories without locale → set to `DEFAULT_CONTENT_LOCALE`
- [ ] For Prompts:
  - For each existing prompt, create 'he' variant with same content
  - Set `promptKey` = original `key`
  - Set `locale` = 'he'
- [ ] Update all Conversations to set `preferredLocale` = `DEFAULT_CONTENT_LOCALE`
- [ ] For Header: migrate to variants array format
- [ ] Log all affected documents

### Step 8.2: Run Type Generation

```bash
pnpm generate:types
```

### Step 8.3: Run Import Map Generation

```bash
pnpm generate:importmap
```

---

## Phase 9: Testing (Reduced Scope)

### Step 9.1: Unit Tests

**Files**: `tests/unit/locale/*.ts`

- [ ] `context.test.ts` - locale resolution order
- [ ] `queries.test.ts` - query helper locale enforcement
- [ ] `prompt-resolver.test.ts` - strict (promptKey, locale) resolution

### Step 9.2: Integration Tests

**Files**: `tests/integration/locale/*.ts`

- [ ] `uniqueness.test.ts` - slug/promptKey uniqueness hooks
- [ ] `course-isolation.test.ts` - tree isolation validation
- [ ] `locale-guard.test.ts` - query helpers enforce locale

### Step 9.3: E2E Tests (Deprioritized)

- [ ] Skip initially - add after locale contract stabilizes

---

## Phase 10: Documentation

### Step 10.1: Update Documentation

- [ ] Update `docs/access-control/README.md` with locale info
- [ ] Add `docs/locale/README.md` with architecture overview
- [ ] Update `src/collections/README.md`

---

## Files Summary

### New Files

| File                                        | Purpose                      |
| ------------------------------------------- | ---------------------------- |
| `src/lib/content-locale/config.ts`          | Content locale constants     |
| `src/lib/locale/context.ts`                 | Locale context resolution    |
| `src/lib/locale/queries.ts`                 | Locale-aware query helpers   |
| `src/lib/locale/route-context.ts`           | Route locale resolution      |
| `src/lib/services/course-tree-isolation.ts` | Course tree validation       |
| `src/hooks/validate-uniqueness.ts`          | Uniqueness enforcement hooks |
| `src/hooks/validate-course-isolation.ts`    | Course isolation hook        |
| `scripts/backfill-locale.ts`                | Data migration               |
| `tests/unit/locale/*.ts`                    | Unit tests                   |
| `tests/integration/locale/*.ts`             | Integration tests            |
| `docs/locale/README.md`                     | Locale documentation         |

### Modified Files

| File                                           | Changes                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `src/collections/Courses.ts`                   | Add `locale`, hooks                      |
| `src/collections/Pages/index.ts`               | Add `locale`                             |
| `src/collections/Posts/index.ts`               | Add `locale`                             |
| `src/collections/Categories.ts`                | Add `locale`                             |
| `src/collections/Prompts.ts`                   | Add `locale`, rename `key` → `promptKey` |
| `src/collections/Conversations.ts`             | Add `preferredLocale`                    |
| `src/Header/config.ts`                         | Refactor to variants array               |
| `src/payload.config.ts`                        | Add indexes                              |
| `src/lib/ai/prompt-resolver.server.ts`         | Update for locale                        |
| `src/lib/services/conversation-service.ts`     | Update for locale                        |
| `src/lib/ai/services/exercise-chat-service.ts` | Update for locale                        |
| Frontend routes                                | Add locale context to queries            |

---

## Acceptance Criteria Per Phase

### Phase 1 (Infrastructure)

- [ ] Content locale config exists and exports required types/functions
- [ ] Locale context resolution follows specified order
- [ ] Query helpers throw/log when locale missing

### Phase 2 (Schema)

- [ ] Courses, Pages, Posts, Categories have required `locale` field
- [ ] Prompts have `promptKey` + `locale`
- [ ] Conversations have `preferredLocale`
- [ ] Header has variants array

### Phase 3 (Uniqueness)

- [ ] Uniqueness hooks prevent duplicate (slug, locale)
- [ ] Uniqueness hooks prevent duplicate (promptKey, locale)
- [ ] DB indexes exist for performance

### Phase 4 (Isolation)

- [ ] Course publish fails if children reference different course
- [ ] Course publish fails if featured pointers escape course

### Phase 5 (Prompts)

- [ ] Prompt resolution uses exact (promptKey, locale)
- [ ] Fallback is opt-in and logged

### Phase 6 (Conversation)

- [ ] New conversations include `preferredLocale`
- [ ] AI service respects conversation locale

### Phase 7 (Routes)

- [ ] Routes use centralized locale resolution
- [ ] All queries pass resolved locale

### Phase 8 (Migration)

- [ ] Backfill script runs without errors
- [ ] All existing content has locale

### Phase 9 (Testing)

- [ ] Unit tests pass
- [ ] Integration tests pass

### Phase 10 (Docs)

- [ ] Documentation updated

---

## Non-Goals (Explicit)

- No automatic translation
- No per-field dynamic language switching
- No fine-grained multilingual content inside learning units
- No separate HeaderEn/HeaderHe globals
- No mixed-locale LMS trees
- No locale on Chapters/Lessons/Exercises
