# Teacher Profile Specification

## Overview

The Teacher Profile feature defines the behavioral identity of the chat for every student-facing request. The selected profile must always be included in the system context sent to the model.

## Scope

### Affects
- All student-facing chat surfaces
- Tone, pedagogy, instructional behavior (via system prompt injection)

### Does NOT Affect
- Adaptive engine
- Study plans
- Tests
- Admin chat
- Memory extraction pipeline
- Vector search pipeline

## Data Model

### Collection: TeacherProfiles

Fields:
- `slug` (unique, indexed)
- `label` (display name)
- `description` (short UI explanation)
- `systemPrompt` → relationship to `Prompts` (required; no text-field alternative)
- `isEnabled` (boolean)

Clarifications:
- `systemPrompt` MUST be a relationship to `Prompts`.
- Only profiles where `isEnabled = true` are selectable and resolvable.
- No `order`.
- No `isDefault` flag.
- Default profile is controlled at configuration level.

### UserSettings (1:1 with User)

**Collection: UserSettings** (NEW - must be created)

Fields:
- `user` → relationship to `Users` (1:1, required, unique)
- `teacherProfile` → relationship to `TeacherProfiles` (optional)

Access:
- User can read/update only own record
- Admin full access
- Create/delete restricted

**Auto-creation mechanism:**
- Add `afterCreate` hook on Users collection
- In the same transaction, create UserSettings with null teacherProfile
- Use `req.payload.create` with `req` for transaction safety

## Guest Behavior (v1)

- Teacher Profile applies to authenticated users only.
- Guests always use the configured default profile (resolved per-request).
- Default profile resolution happens at request time, not stored in session.

## Chat Orchestrator Integration

### Step 1 — Resolve Teacher Profile

1. For authenticated users: Load `UserSettings.teacherProfile`.
2. If null, missing, or disabled → fallback to configured default profile (env var or ConfigValues).
3. Fetch full `TeacherProfiles` entity (with depth=1 for systemPrompt).
4. Load its related `systemPrompt` content (template field).
5. For guests: Skip to step 2 with default profile.

### Step 2 — Build System Context (strict order)

System context MUST follow this order:
1. `<Base system prompt>`
2. `<teacher_profile>` block
3. Lesson / course context

Structure:
```
<Base system prompt>

<teacher_profile>
Name: {label}
Description: {description}

Behavior:
{systemPrompt text}
</teacher_profile>
```

Rules:
- Append only. Never replace base system prompt.
- Inject BEFORE lesson context.
- Do NOT pass teacher_profile block into memory extraction (use separate parameter).
- Do NOT include in vector search embedding.
- Do NOT store as a chat message.
- Must use existing `UnifiedLLMProvider` and `AI_MODELS`.

**Implementation detail:** Pass teacher_profile as separate parameter to `composePrompt()`. Memory extraction function should accept optional `excludeTeacherProfile` flag or receive only base instructions.

## Runtime Behavior

- Switching Teacher Profile affects the very next chat response.
- No lesson reset required.
- No per-lesson override (v1).
- No per-chat override (v1).
- Global account-level identity only.

## Default Strategy

If:
- User has no selected profile
- Profile missing
- Profile disabled

→ Use system-configured default Teacher Profile.

Default resolution order:
1. Environment variable: `DEFAULT_TEACHER_PROFILE_SLUG` (highest priority)
2. ConfigValues: domain='teacher_profiles', config.defaultProfileSlug
3. Fallback: hardcoded 'teacher_focused' slug (must exist in seed data)

The default profile slug MUST exist in TeacherProfiles with isEnabled=true.

## UI Behavior

Location:
- Account → Teacher Profile (existing tab in AccountHub)
- Existing placeholder component: `TeachersProfileSection.tsx`

Selection:
- User selects exactly one profile (single-select)
- Immediate save (recommended) or explicit save
- Toast confirmation
- Change applies instantly to subsequent chat calls

In Chat UI:
- Display current Teacher Profile label near chat header

**Required i18n keys:**
- `auth.account.teachersProfilePlaceholder`
- `auth.account.sectionTeachersProfile`
- `auth.account.selectTeacherProfile`
- `auth.account.currentTeacherProfile`
- `auth.account.profileChanged`

## Seeding Requirements (data must exist)

Create:
1. **5 Prompts** entries (raw text) for teacher profiles.
2. **5 TeacherProfiles** entries referencing those Prompts via `systemPrompt` relationship.

Profile Slugs:
- `teacher_strict`
- `teacher_thorough`
- `teacher_patient`
- `teacher_focused` (default)
- `teacher_challenging`

## Acceptance Criteria

- TeacherProfiles collection exists with all required fields.
- UserSettings collection exists with user (1:1) and teacherProfile fields.
- `systemPrompt` is strictly a relationship to Prompts.
- Only enabled profiles are selectable/resolvable.
- UserSettings.teacherProfile works 1:1 with Users.
- UserSettings auto-created on signup via afterCreate hook.
- Teacher Profile injected in correct system prompt order (base → teacher_profile → lesson context).
- Injection excluded from memory/vector pipelines (via separate parameter).
- Switching profile changes behavior immediately.
- Default profile configurable via DEFAULT_TEACHER_PROFILE_SLUG env var.
- Translation keys exist for all UI strings.
- Guest requests use default profile (resolved per-request).
- Adaptive engine and other subsystems unaffected.
- Chat behaves as the selected teacher identity.
