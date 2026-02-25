# Spec: 260225-auto-70

## Overview

Implement a global teacher persona selection feature that allows users to choose a teaching style (e.g., strict, patient, focused) during onboarding or within their profile. This persona will be injected into the system prompt for all student-facing chat surfaces to adjust the AI's tone and pedagogy without affecting other backend engine operations.

## Requirements

### FR-001: UserPreferences Collection

**Priority**: MUST
**Description**: Create a `UserPreferences` collection (1:1 with `Users` using Payload 3.x `join`) with a `teacherPersona` relationship field to the `Prompts` collection (filtered by `type: persona`). Implement row-level security so users can read/update only their own record (`user: { equals: user.id }`), while admins have full access. Creation and deletion should be restricted to admins/internal.

### FR-002: Prompts Collection Update

**Priority**: MUST
**Description**: Update the `Prompts` collection to add a `type` field (with `persona` option) and a `slug` field (unique and indexed). Seed the database with the 5 default personas: strict, thorough, patient, focused (default), and challenging.

### FR-003: Registration Flow Integration

**Priority**: MUST
**Description**: Add a persona selection step to the registration/onboarding flow with 5 persona cards (single select). Allow users to skip (defaults to `persona_focused`).

### FR-004: Anonymous Persona Support

**Priority**: MUST
**Description**: Store persona selection for anonymous users in a short-lived cookie (not localStorage). Migrate this cookie to `UserPreferences.teacherPersona` upon registration, including OAuth flows.

### FR-005: Profile Settings

**Priority**: MUST
**Description**: Allow users to view and update their persona at any time from their profile settings. Use Server Actions for mutation and shadcn `useToast` for confirmation.

### FR-006: Chat Orchestrator Integration

**Priority**: MUST
**Description**: Fetch the selected persona from Payload by slug at runtime and append it inside a `<teacher_persona>` XML block to the existing step-1 system prompt for all student-facing chat requests.

### FR-007: UI Visibility

**Priority**: MUST
**Description**: Display the current persona label near the chat interface. All strings must use `next-intl` (`useTranslations`).

### NFR-001: Resolution Strategy

**Priority**: MUST
**Description**: Persona resolution must follow this order: 1) Logged-in valid `UserPreferences.teacherPersona`, 2) Valid cookie, 3) Fallback to `persona_focused`.

### NFR-002: Immediate Application

**Priority**: MUST
**Description**: Persona changes must apply immediately to subsequent chat messages without requiring a lesson reset.

### NFR-003: Pipeline Exclusion

**Priority**: MUST
**Description**: The persona injection must be excluded from memory-extraction and vector-search steps.

## Acceptance Criteria

- [ ] `UserPreferences` exists (1:1 with Users) with `teacherPersona` relationship.
- [ ] `Prompts` supports `type: persona` + unique indexed `slug`.
- [ ] All 5 personas exist in DB.
- [ ] Registration allows select or skip (default = persona_focused).
- [ ] Anonymous persona stored in cookie and migrated on registration.
- [ ] Profile allows change anytime with toast confirmation.
- [ ] Persona injected inside step‑1 system prompt using `<teacher_persona>` XML.
- [ ] Injection excluded from memory/vector pipelines.
- [ ] Switching persona changes subsequent responses immediately.
- [ ] Persona label visible in chat.
- [ ] Adaptive engine, tests, study plans, admin chat remain unaffected.

## Guardrails

- Do NOT replace the base prompt; only append the `<teacher_persona>` block.
- Must use existing `UnifiedLLMProvider` and `AI_MODELS`.
- Interactive UI components must be Client Components using shadcn UI and RTL-first Tailwind.
- Do not use localStorage; short-lived cookies must be used for anonymous tracking.
- Hardcoding persona texts is strictly prohibited; they must be fetched from Payload.

## Out of Scope

- Applying personas to the adaptive engine, study plans, tests, or admin chat.
- Modifying the existing system prompts beyond the `<teacher_persona>` appending.