# PRD: Localization & Locale Ownership Model

## Goal
Define a clear, enforceable localization model across the platform (LMS, CMS, Chat, AI) that:
- Prevents language mixing
- Avoids data duplication
- Scales cleanly to additional languages
- Keeps the data model simple and predictable

---

## Non-Goals
- Automatic translation
- Per-field dynamic language switching
- Fine-grained multilingual content inside a single learning unit

---

## Core Principle
**Locale is assigned only to user-facing, publishable units.**
Internal, derived, or technical entities inherit locale implicitly or do not require localization at all.

---

## Locale Rules (Authoritative)

### 1. Entities That MUST Have `locale`

These entities represent standalone, user-facing content:

#### LMS / CMS
- `Courses`
- `Pages`
- `Posts`
- `Categories` (if visible in UI)

#### CMS Globals
- `Header` (localized variants)
- `Footer` (localized variants)

#### AI
- `Prompts`
  - Same logical prompt may exist in multiple locale variants
  - Linked by a stable `promptKey`

#### Chat
- `Conversations`
  - Field: `preferredLocale`
  - Defines expected language of AI responses

#### Forms
- `Forms` (definition only)
  - Labels, placeholders, consent text are language-specific

---

### 2. Entities That MUST NOT Have `locale`

These entities are internal, derived, or purely technical:

#### LMS Internals (inherit from Course)
- `Chapters`
- `Lessons`
- `Exercises`
- `Exercise Assets`

#### System / Data
- `Users`
- `User Progresses`
- `Tenants`
- `Pricing Plans` (unless marketing text is embedded)
- `Media` (file itself)
- `Form Submissions`
- `Redirects`
- `Mcp Audit Logs`
- `Search Results`
- `Memory_items` (default: language-agnostic)

---

## Media Localization Policy

- `Media` represents binary assets (image/video/file)
- **Media MUST NOT have `locale`**
- Optional localized metadata:
  - `alt`
  - `caption`
  - `title`
- Metadata localization can be implemented via:
  - Per-locale fields
  - Or a translations sub-object
- Media files MUST NOT be duplicated per language

---

## Inheritance & Guards

### LMS Guardrails
- All `Chapters`, `Lessons`, `Exercises` inherit locale from parent `Course`
- Mixing locales within a single course is forbidden
- Validation required on save and publish

### Query Rules
- Any content fetch for user display MUST be filtered by `locale`
- Missing locale in a user-facing query is considered a bug

---

## Chat Language Rules
- `preferredLocale` is defined per `Conversation`
- UI language and chat response language may differ
- Messages do not require a strict `locale`
  - Optional: `detectedLanguage` for analytics only

---

## Risks if Violated
- Language mixing within pages or lessons
- Duplicate content trees per language
- Broken search, analytics, and AI grounding
- Long-term migration pain when adding new locales

---

## Success Criteria
- Zero mixed-language pages in production
- No duplicated LMS trees per language
- Clear ownership of locale per entity
- Ability to add a new language without schema changes

---

## Open Questions (Explicit)
- Are `Pricing Plans` ever user-facing with rich text?
- Is `Memory_items` used for user recall or system only?
- Will CMS Globals be fully duplicated per locale or partially shared?

(Answers determine minor extensions, not the core model.)
