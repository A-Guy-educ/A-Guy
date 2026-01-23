# HLS: Localization & Locale Ownership Implementation (Revised)

## Scope
Implement the approved locale model across LMS, CMS, Chat, and AI with **hard guardrails** and **deterministic locale-aware queries**.

---

## High-Level Architecture

### Locale as a First-Class Context
Locale must be resolved **before any user-facing content fetch**.

Locale resolution order:
1. Explicit request param (e.g. `?locale=he`)
2. Conversation context (`preferredLocale`)
3. User preference
4. System default

**Rule:** UI language ≠ content language (explicit separation allowed).

---

## Data Model Changes

### Collections WITH Locale
Add a required, indexed field:

- `locale: string` (ISO-639-1, e.g. `"en"`, `"he"`)

Applies to:
- Courses
- Pages / Posts
- Categories (only if rendered in UI)
- Forms (definition only)
- Prompts
- Conversations: `preferredLocale`
- Header / Footer (globals → per-locale variants)

Constraints:
- `locale` is required
- `locale` is indexed
- `locale` is immutable after publish (admin override only)

Indexes:
- `(slug, locale)` where `slug` exists
- `(promptKey, locale)` for prompts

---

### Collections WITHOUT Locale
No schema changes:
- Chapters
- Lessons
- Exercises
- Exercise Assets
- Media (binary file)
- Users
- User Progresses
- Form Submissions
- Logs / Audit / Search
- Memory_items (default)

Locale inheritance is **implicit**, never duplicated.

---

## Known Gaps & Required Enforcement (Authoritative)

### 1) Locale MUST Be Mandatory in User-Facing Queries (CRITICAL)
**Policy:** Any API/fetch used to render user-facing content MUST include locale context.

Enforcement:
- Development: missing locale context => hard error
- Production: log warning + apply explicit fallback only if configured

**Definition (user-facing):**
- LMS pages that display courses or course-derived content
- CMS pages/posts/categories
- Prompt resolution for AI
- Header/Footer rendering
- Forms rendering (definition)

---

### 2) Hard Guards Against Mixed-Language LMS Trees (CRITICAL)
**Invariant:** One Course = one Locale. No mixed-language content under a course.

Because Chapters/Lessons/Exercises do not have `locale`, correctness depends on ownership rules.

Enforcement:
- All child entities must be attached to exactly one Course
- Disallow cross-course references that would pull content from a different course
- Publish-time validation blocks publishing if:
  - course locale missing
  - any child references a different course
  - any UI-configured “featured” lesson/exercise points outside the course

---

### 3) Prompts MUST Resolve by (promptKey, locale) (HIGH)
**Policy:** Prompt selection is deterministic by locale.

Requirements:
- Add `promptKey` to Prompts
- Store one prompt per `(promptKey, locale)`
- Resolution order:
  1. exact `(promptKey, locale)`
  2. optional fallback locale (explicitly configured)
- Never silently choose a different-language prompt

---

### 4) Forms: Definition Localized, Submissions Not (MEDIUM)
- `Forms` (definition): localized (labels/placeholders/consent text)
- `Form Submissions`: never localized
- Queries for forms displayed in UI must filter by locale

---

### 5) Media: Binary Not Localized, Metadata May Be (MEDIUM)
- `Media` MUST NOT have `locale`
- Optional localized metadata:
  - `altByLocale`
  - `captionByLocale`
  - `titleByLocale`
- Metadata is resolved at render-time using the page/course locale
- Media files must not be duplicated per locale

---

## LMS Guardrails

### Write-Time Validation
- Chapter/Lesson/Exercise must reference a Course (directly or via parent chain)
- Any reference that escapes the course boundary is rejected (or flagged)

### Publish-Time Validation
- Course must have `locale`
- Course publish fails if:
  - any derived content is missing course linkage
  - any “featured” pointers escape the course
  - any locale-aware queries are absent in the rendering path (dev-only guard)

---

## CMS & Globals
- Header/Footer: one document per locale (no partial sharing)
- Render-time resolution strictly by locale context

---

## Chat System

### Conversations
- Add required `preferredLocale`
- Used as the primary driver for AI output language

### Messages
- No strict locale required
- Optional `detectedLanguage` for analytics only

### AI Output
- Response language driven solely by `preferredLocale`
- Prompt resolved by `(promptKey, preferredLocale)`
- No silent fallback across languages

---

## API & Query Contract

### Mandatory Rule
Every user-facing route/function must accept or derive a locale context and pass it to the data layer.

Implementation expectations:
- Centralize locale resolution (one module/service)
- Centralize locale-aware fetch helpers for:
  - CMS content
  - Globals (header/footer)
  - Courses (and course-derived views)
  - Forms definitions
  - Prompt resolution

---

## Indexing & Performance
Add indexes on:
- `locale`
- `(slug, locale)`
- `(promptKey, locale)`

No locale joins required; no traversal for inheritance.

---

## Rollout Strategy
1. Add locale fields + indexes
2. Backfill existing content with default locale
3. Add query-layer mandatory locale enforcement (dev hard error)
4. Add LMS publish-time validation
5. Add admin UX for multi-locale content creation

---

## Non-Optional Invariants
- No mixed-language LMS trees
- No locale on internal LMS nodes
- No duplicated media per locale
- No user-facing render without locale context
- No prompt selection without `(promptKey, locale)` resolution

---

## Exit Criteria
- A new locale can be added without schema refactor
- All user-facing content requires locale in queries
- LMS course trees are provably single-locale
- AI response language is deterministic per conversation
