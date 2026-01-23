# GAP Analysis: Localization & Locale Ownership

## Purpose
Identify gaps between the **approved localization model** and the **current system state**, in order to:
- Prevent language leakage
- Avoid structural rewrites later
- Define concrete corrective actions

---

## Target State (Reference)
- Locale exists **only** on publishable, user-facing units
- LMS locale is owned by `Course`
- CMS, Prompts, Chat have explicit locale ownership
- Internal entities inherit or are locale-agnostic
- All user-facing queries are locale-aware

---

## GAP 1: Locale Ownership Is Not Explicit Everywhere
**Severity:** Critical

### Current State
- Locale handling is implicit / inconsistent
- Some user-facing entities lack a required locale
- Locale resolution is partially inferred from UI context

### Impact
- Risk of mixed-language pages
- Non-deterministic content rendering
- Hidden bugs when adding new languages

### Required Fix
- Add mandatory `locale` field to:
  - Courses
  - Pages / Posts
  - Categories (if rendered)
  - Forms (definition)
  - Prompts
  - Conversations (`preferredLocale`)
- Enforce schema-level requirement + index

---

## GAP 2: No Hard Guard Against Mixed-Language LMS Trees
**Severity:** Critical

### Current State
- Chapters / Lessons / Exercises rely on convention
- No publish-time validation guarantees single-language course

### Impact
- Silent corruption of learning experience
- Impossible-to-fix content trees later

### Required Fix
- Enforce invariant:
  - One Course = one Locale
  - All children belong to exactly one Course
- Block publish if invariant is violated

---

## GAP 3: Locale Not Mandatory in Content Queries
**Severity:** Critical

### Current State
- Some fetches rely on defaults or UI language
- Locale not always explicit in API layer

### Impact
- Wrong-language content in edge cases
- Hard-to-reproduce bugs
- AI grounding errors

### Required Fix
- Mandatory locale context for every user-facing fetch
- Dev: throw error if missing
- Prod: log + fallback only if explicitly configured

---

## GAP 4: Prompts Not Modeled as Locale Variants
**Severity:** High

### Current State
- Prompts treated as single entities
- Language differences handled informally

### Impact
- AI responses in wrong language
- Prompt drift between languages
- Impossible to version correctly

### Required Fix
- Introduce `promptKey`
- Store one prompt per `(promptKey, locale)`
- Resolve prompts strictly by locale

---

## GAP 5: Media Metadata Localization Undefined
**Severity:** Medium

### Current State
- Media treated as generic assets
- No clear policy for localized alt/caption/title

### Impact
- Accessibility issues
- SEO inconsistencies
- Ad-hoc fixes later

### Required Fix
- Keep Media binary locale-agnostic
- Define optional localized metadata structure
- Resolve metadata at render-time via page/course locale

---

## GAP 6: Forms Definition vs Submission Not Separated Clearly
**Severity:** Medium

### Current State
- Forms treated inconsistently as content vs data
- Locale responsibility unclear

### Impact
- Over-localization or under-localization
- Messy analytics

### Required Fix
- Forms (definition): localized
- Form submissions: never localized
- Explicit separation in schema and code

---

## GAP 7: Chat Language Control Not Explicit Enough
**Severity:** Medium

### Current State
- Chat language inferred from UI or prompt
- No single source of truth per conversation

### Impact
- AI responses switching language mid-thread
- Poor user trust

### Required Fix
- Add `preferredLocale` to Conversation
- Use it as the sole driver for AI output language
- Messages remain locale-agnostic (optional detection only)

---

## Summary Table

| Gap | Area | Severity | Action Required |
|----|-----|----------|-----------------|
| 1 | Locale ownership | Critical | Add required locale fields |
| 2 | LMS integrity | Critical | Enforce single-locale course |
| 3 | Query layer | Critical | Locale mandatory in fetch |
| 4 | Prompts | High | Locale-based prompt variants |
| 5 | Media metadata | Medium | Define localized metadata |
| 6 | Forms | Medium | Separate definition vs data |
| 7 | Chat | Medium | Explicit conversation locale |

---

## Exit Condition
All critical gaps closed, such that:
- Adding a new language does **not** require schema refactor
- No user-facing content can render without a locale
- LMS trees are provably single-language
- AI output language is deterministic
