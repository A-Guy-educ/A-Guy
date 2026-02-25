# Spec: 260225-auto-38

## Overview

The chat system acts as the teacher for students. The selected "Teacher Profile" defines the behavioral identity, tone, and pedagogical approach of the chat for every student-facing request. This profile must be dynamically included in the system context sent to the LLM. The feature allows users to select a Teacher Profile, which instantly alters the chat's instructional behavior without affecting underlying adaptive engines, memory extraction, or study plans.

## Requirements

### FR-001: TeacherProfiles Collection
**Priority**: MUST
**Description**: Create a `TeacherProfiles` collection to store teacher identities. 
- Fields: `slug` (unique, indexed), `label` (display name), `description` (short UI explanation), `systemPrompt` (relationship to `Prompts` collection - required, no text-field alternative), `isEnabled` (boolean). 
- Must NOT include `order` or `isDefault` flags. The default profile is controlled at the configuration level.

### FR-002: UserSettings Profile Field
**Priority**: MUST
**Description**: Update the `UserSettings` collection (1:1 with User) to include a `teacherProfile` field (relationship to `TeacherProfiles`).
- Access control: Users can read/update only their own record; Admins have full access; Create/delete is restricted.

### FR-003: Auto-Create UserSettings on Signup
**Priority**: MUST
**Description**: Implement a hook-based or equivalent transactional mechanism to automatically create a `UserSettings` record when a new user signs up.

### FR-004: Profile Resolution Logic
**Priority**: MUST
**Description**: For every student-facing chat request, resolve the Teacher Profile by loading `UserSettings.teacherProfile`. If it is null, missing, or `isEnabled = false`, fallback to the system-configured default profile. (Guest users will always use the default profile).

### FR-005: System Prompt Context Construction
**Priority**: MUST
**Description**: Build the system context in a strict sequential order: 
1. `<Base system prompt>`
2. `<teacher_profile>` block (containing Name: {label}, Description: {description}, Behavior: {systemPrompt text})
3. Lesson / course context.

### FR-006: Profile Selection UI
**Priority**: MUST
**Description**: Add a Teacher Profile selection interface under "Account → Teacher Profile". Users can single-select an enabled profile. Upon selection, immediately save (or explicitly save) and show a toast confirmation.

### FR-007: Chat UI Identity Display
**Priority**: SHOULD
**Description**: Display the currently active Teacher Profile label near the chat header in the Chat UI so the student knows which teacher persona is active.

### NFR-001: Subsystem Isolation
**Priority**: MUST
**Description**: The injected `<teacher_profile>` block MUST be strictly excluded from the memory extraction pipeline, vector search embedding, and MUST NOT be stored as a historical chat message in the database.

### NFR-002: Immediate Runtime Application
**Priority**: MUST
**Description**: Switching a Teacher Profile must affect the very next chat response instantly without requiring a lesson reset or browser refresh.

### NFR-003: Provider Compatibility
**Priority**: MUST
**Description**: The profile injection must utilize the existing `UnifiedLLMProvider` and `AI_MODELS` architecture.

## Acceptance Criteria

- [ ] `TeacherProfiles` collection exists with all specified fields.
- [ ] `systemPrompt` field on `TeacherProfiles` is strictly a relationship to the `Prompts` collection.
- [ ] Only profiles with `isEnabled = true` are selectable in the UI and resolvable by the orchestrator.
- [ ] `UserSettings.teacherProfile` works as a 1:1 relationship to store user preference.
- [ ] `UserSettings` record is automatically created upon user signup via hooks/transactions.
- [ ] Teacher Profile is injected into the system prompt in the exact strict order: Base -> Teacher -> Context.
- [ ] Profile injection is successfully excluded from memory extraction and vector search pipelines.
- [ ] Switching a profile changes the chat behavior immediately on the subsequent message.
- [ ] The Chat UI visibly displays the current Teacher Profile label near the chat header.
- [ ] The adaptive engine, study plans, tests, and other subsystems are demonstrably unaffected by profile changes.
- [ ] Chat behaves and responds in alignment with the selected teacher identity's pedagogical instructions.

## Guardrails

- NEVER replace or overwrite the base system prompt; the teacher profile must be appended to it.
- The `<teacher_profile>` block MUST be injected BEFORE the lesson context.
- DO NOT pass the teacher profile block into the memory extraction pipeline.
- DO NOT include the teacher profile block in vector search embeddings.
- DO NOT store the teacher profile block as a standard chat message in the database.
- DO NOT add per-lesson or per-chat profile overrides in this version (global account-level identity only).

## Out of Scope

- Modifications to the Adaptive engine, Study plans, or Tests.
- Modifications to Admin chat behavior.
- Changes to the underlying Memory extraction or Vector search pipeline logic.
- Per-lesson or per-chat Teacher Profile overrides.
- Custom Teacher Profiles for unauthenticated (guest) users.