# Spec: teacher-persona-selection

## Overview

Implement a global teacher persona selection that allows students to choose their preferred teacher persona during the registration flow (optional) or anytime from their user profile. This persona determines the AI teacher's pedagogy and tone in the student-facing Copilot chat by injecting a specific prompt block into the chat orchestrator.

## Requirements

### FR-001: UserPreferences Collection

**Priority**: MUST
**Description**: Create a `UserPreferences` collection to store user-specific settings. It must have a one-to-one relationship with the `Users` collection. This should use Payload 3.x's `join` field on the `Users` collection for a clean two-way link. It must contain a `teacherPersona` field which is a relationship to the `Prompts` collection (filtered by type: 'persona').

### FR-002: Prompts Collection Update

**Priority**: MUST
**Description**: Add a new prompt type `persona` to the existing `Prompts` collection to store the teacher persona definitions. Update the `Prompts` collection `type` select options to include `persona`. Add the default placeholder personas (e.g., `persona_1`, `persona_2`, `persona_3`, and `persona_default`) to the database using this new type. Add a `slug` field (with `unique: true`, `index: true`) to the `Prompts` collection to use as a consistent identifier on the frontend.

### FR-003: Registration Flow Persona Selection

**Priority**: MUST
**Description**: Add an optional step during the user registration/onboarding flow to select 1 of 3 teacher personas. The UI should display 3 selectable cards (single-select), a "Skip" option, and a "Continue" button. Ensure the use of Shadcn/UI components (`Card`, `Button`, `RadioGroup`) and Tailwind utilities (with RTL-first logical properties). Interactive parts must be Client Components (`.client.tsx`).

### FR-004: Fallback and Default Persona

**Priority**: MUST
**Description**: If the user skips the persona selection during registration or if the persona is missing/invalid, automatically assign the default persona (`persona_default` via slug).

### FR-005: Anonymous User Support

**Priority**: MUST
**Description**: For anonymous users, store the selected `teacherPersona` in a short-lived cookie (NOT local storage) to ensure compatibility with Next.js SSR and OAuth redirects. If the anonymous user later registers, the persona must carry over and persist to their `UserPreferences` record.

### FR-006: Profile Settings Persona Management

**Priority**: MUST
**Description**: Add a setting in the user profile to view the current teacher persona and change it at any time. The UI should display the current selection, allow changing with the same 3 options from registration, and show a save confirmation using the shadcn `useToast` hook. Use Server Actions to securely mutate the `UserPreferences` collection.

### FR-007: Copilot Chat Orchestrator Integration

**Priority**: MUST
**Description**: Inject the selected persona's text into the system message for every student chat request. The persona block MUST be concatenated *inside* the existing step-1 system prompt using `<teacher_persona>` XML boundaries to maintain Context Policy V1 ordering. (e.g., `<teacher_persona>You are teacher persona {id}… [behavior rules]</teacher_persona>`).

### FR-008: Immediate Effect

**Priority**: MUST
**Description**: Changing a persona (even during an active lesson) must apply immediately to future chat messages. No state resets are required.

### FR-009: Chat UI Visibility (Demo)

**Priority**: MUST
**Description**: Display the current teacher label near the chat (e.g., "Teacher: X") so the adaptation is visible during demonstrations. All UI strings must use `useTranslations()` from `next-intl`.

### FR-010: UserPreferences Auto-Creation Hook

**Priority**: MUST
**Description**: Add an `afterChange` hook to the `Users` collection to automatically create a `UserPreferences` document when a new user signs up, ensuring transaction safety (passing `req`) and bypassing access control (`overrideAccess: true`).

### NFR-001: Access Control

**Priority**: MUST
**Description**: Apply proper row-level security to the `UserPreferences` collection. Users can only read and update their own preference records (`user: { equals: user.id }`). Admins have full access. `create` and `delete` should be restricted to admins or internal processes.

## Acceptance Criteria

- [ ] A `UserPreferences` collection exists with a `teacherPersona` relationship field and is linked 1-to-1 with the `Users` collection.
- [ ] The `Prompts` collection supports the `persona` type and has a unique `slug` field.
- [ ] New users can select a persona during registration but may skip.
- [ ] Anonymous users have their persona selection stored in a cookie and it restores on refresh.
- [ ] Anonymous users' persona selections migrate to their database `UserPreferences` upon registration (including OAuth flows).
- [ ] Users can view and change their persona anytime in their profile settings, with a visual confirmation of saving (toast).
- [ ] UI is implemented using Shadcn/UI, Tailwind (RTL-first), and `next-intl` for translations.
- [ ] Copilot chat requests successfully retrieve the user's selected persona (or the default) and inject the persona text inside the system prompt using XML boundaries.
- [ ] Switching a persona changes the chat output style reliably and immediately for subsequent messages.
- [ ] The current teacher persona name is visible near the chat interface.

## Guardrails

- The persona selection must ONLY affect the chat tone and pedagogy via the prompt injection.
- Do NOT alter adaptive lesson engine logic, branching engines, study plan generators, test countdowns, test generators, or admin chat based on the persona.
- Ensure transaction safety when creating/updating `UserPreferences` during user creation hooks.
- Handle OAuth registration edge cases: use a short-lived cookie to transfer the persona choice before redirecting to the provider.
- Must use existing `UnifiedLLMProvider` singleton and `AI_MODELS` constants; do not instantiate new LLM clients.
- Persona injection must not interfere with or be passed to the `memory-extraction` or `vector-search` pipeline steps.

## Out of Scope

- Persona affecting adaptive lesson engine logic or branching.
- Persona affecting study plan generator, test countdown, test generator, or admin chat.
- Finalizing the actual persona copy/definitions (placeholders are acceptable for now).
