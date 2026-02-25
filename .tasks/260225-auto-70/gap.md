# Gap Analysis: 260225-auto-70

## Summary

- Gaps Found: 8
- Spec Revised: Yes

## Gaps Found

### Gap 1: UserPreferences 1:1 Relationship Pattern

**Severity:** High
**Location:** Data Model section (spec.md lines 11-17)
**Issue:** The spec mentions "Payload 3.x `join`" for 1:1 relationship with Users, but this field type doesn't exist in Payload CMS. The codebase uses standard relationship fields with unique constraints for 1:1 patterns.
**Fix Applied:** Updated FR-001 to use standard relationship field pattern with unique constraint instead of non-existent "join" field type.

### Gap 2: Prompts Collection - Field Clarification

**Severity:** High
**Location:** Prompts Collection Update section (spec.md lines 19-22)
**Issue:** 
- The current Prompts collection has `type` field with options: ['system', 'context']. Adding 'persona' requires extending options.
- The current collection has `key` field which is unique. The spec adds `slug` but doesn't clarify relationship to `key`.
- Need to clarify: Does `slug` replace `key`, or is it an additional field?
**Fix Applied:** Added FR-002 specifying that 'persona' should be added to existing type options, and `slug` is a new field for persona lookup.

### Gap 3: Server-Side Cookie Handling Missing

**Severity:** Critical
**Location:** Anonymous Support section (spec.md lines 43-50)
**Issue:** The spec requires cookie storage that "must survive refresh and OAuth redirects". The codebase only has client-side cookie utilities (`/src/infra/analytics/utils/cookies.ts` uses `document.cookie`). OAuth redirects happen server-side, so we need server-side cookie handling.
**Fix Applied:** Added FR-004 requiring server-side cookie utilities that work in both client and server contexts.

### Gap 4: Server Actions Already Exist - Clarify Pattern

**Severity:** Medium
**Location:** Profile Settings section (spec.md lines 52-56)
**Issue:** The spec says "Uses Server Actions for mutation" which aligns with existing codebase patterns (`/src/app/(frontend)/signup/actions/`, `/src/app/(frontend)/login/`). However, the spec doesn't mention cookie handling in the Server Action, which is critical for migration from anonymous to authenticated state.
**Fix Applied:** Added FR-005 to clarify Server Action must handle cookie migration on profile change.

### Gap 5: Persona Injection Location - Need Pipeline Details

**Severity:** High
**Location:** Chat Orchestrator Integration section (spec.md lines 58-71)
**Issue:** The spec says "Append inside existing step-1 system prompt" with `<teacher_persona>` XML tag. Looking at `prompt-composer.server.ts`, system prompts are composed in order:
1. System prompts (joined)
2. Lesson prompt
3. Lesson context

The spec needs to clarify: Should persona be injected BEFORE lesson prompt (so it's more general) or AFTER (so lesson can override)?
**Fix Applied:** Added FR-006 specifying the injection order and that persona is appended after system prompts but before lesson-specific content.

### Gap 6: UI Translation Keys - Missing Namespace

**Severity:** Medium
**Location:** UI Visibility section (spec.md lines 73-75)
**Issue:** The spec says "All strings via next-intl (useTranslations)" but doesn't specify the translation namespace. The codebase uses namespaces like `homepage.greeting`, `auth.login`, etc.
**Fix Applied:** Added requirement for translation namespace structure (e.g., `persona.selection`, `persona.profile`, `persona.chat`).

### Gap 7: Chat UI Component - Missing Specification

**Severity:** Medium
**Location:** UI Visibility section (spec.md lines 73-75)
**Issue:** The spec mentions "Display current persona label near chat" but doesn't specify:
- Which chat surfaces (Ask, Exercise, Study)?
- What component renders it?
- Where exactly (header, sidebar, tooltip)?
**Fix Applied:** Added FR-007 requiring specification of chat surfaces and component location.

### Gap 8: Invalid Persona Slug Handling - Missing Edge Case

**Severity:** Low
**Location:** Resolution Order section (spec.md lines 47-50)
**Issue:** The resolution order is defined, but what happens when:
- The stored persona slug doesn't exist in DB?
- The user has a deleted persona?
- The cookie contains an invalid slug?
**Fix Applied:** Added NFR-004 specifying fallback behavior for invalid persona slugs.

## Changes Made to Spec

### Added Functional Requirements (FR)

- **FR-001**: UserPreferences collection with `user` relationship (unique constraint for 1:1), `teacherPersona` relationship to Prompts filtered by `type=persona`, and proper row-level security using `authenticatedOrOwner` pattern.
- **FR-002**: Prompts collection update - extend `type` options to include 'persona', add new `slug` field (unique, indexed) for persona lookup by slug.
- **FR-004**: Server-side cookie utilities for anonymous persona storage, supporting both Next.js server actions and client-side setting.
- **FR-005**: Profile Server Action must handle persona change AND migration from anonymous cookie to UserPreferences on registration.
- **FR-006**: Persona injection happens in `composeSystemInstructions()` - appends `<teacher_persona>` XML block after system prompts but before lesson-specific content. Memory extraction uses separate prompt, so exclusion is automatic.
- **FR-007**: Persona label component for chat surfaces - specify location (e.g., header toolbar near input), use existing shadcn Badge component, localized via `persona.chat` namespace.

### Added Non-Functional Requirements (NFR)

- **NFR-004**: Invalid persona slug handling - if stored slug doesn't exist or is deleted, fallback to `persona_focused` silently.
- **NFR-005**: Cookie settings - `max-age=30 days`, `SameSite=Lax`, `Path=/`.

### Updated Acceptance Criteria

- AC-1: Updated to clarify 1:1 relationship via unique constraint on user field
- AC-2: Clarified slug is for persona lookup, key remains for internal use
- AC-11: Added note that adaptive engine, tests, study plans, admin chat use separate prompts (not affected by persona)

### Updated Implementation Notes

- Add `type: 'persona'` to Prompts.type options (extend existing field, not replace)
- Add `slug` field (text, unique, indexed) - NOT replacing `key`
- Use existing `authenticatedOrOwner` access pattern from `/src/server/payload/access/authenticatedOrOwner.ts`
- Persona injection in `composeSystemInstructions()` in `/src/infra/llm/prompt-composer.server.ts`
- Server Action pattern from `/src/app/(frontend)/signup/actions/signup_createUser-action.ts` as template
