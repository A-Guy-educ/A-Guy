# Task

## Issue Title

Teacher Profile – Chat Identity Specification (v1.1)
## Core Principle

The chat **is the teacher**.

The selected Teacher Profile defines the behavioral identity of the chat for every student-facing request.
The selected profile must always be included in the system context sent to the model.

---

# Scope

## Affects

* All student-facing chat surfaces
* Tone, pedagogy, instructional behavior

## Does NOT Affect

* Adaptive engine
* Study plans
* Tests
* Admin chat
* Memory extraction pipeline
* Vector search pipeline

---

# Data Model

## Collection: TeacherProfiles

Fields:

* `slug` (unique, indexed)
* `label` (display name)
* `description` (short UI explanation)
* `systemPrompt` → relationship to Prompts (**required, no text-field alternative**)
* `isEnabled` (boolean)

Clarifications:

* `systemPrompt` MUST be a relationship to `Prompts` (no OR option).
* Only profiles where `isEnabled = true` are selectable and resolvable.
* No `order`.
* No `isDefault` flag.
* Default profile is controlled at configuration level.

---

## UserSettings (1:1 with User)

Field:

* `teacherProfile` → relationship to TeacherProfiles

Access:

* User can read/update only own record
* Admin full access
* Create/delete restricted

Clarification:

* UserSettings must be automatically created on user signup (hook-based or equivalent transactional mechanism).

---

# Guest Behavior (Clarification)

If guest chat exists:

* Teacher Profile applies to authenticated users only (v1).
* Guests always use the configured default profile.

---

# Chat Orchestrator Integration

For every student-facing chat request:

### Step 1 — Resolve Teacher Profile

1. Load `UserSettings.teacherProfile`
2. If null, missing, or disabled → fallback to configured default profile
3. Fetch full TeacherProfile entity
4. Load its related `systemPrompt` content

---

### Step 2 — Build System Context (Strict Order Clarification)

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

* Append only. Never replace base system prompt.
* Inject BEFORE lesson context.
* Do NOT pass this block into memory extraction.
* Do NOT include in vector search embedding.
* Do NOT store as a chat message.
* Must use existing UnifiedLLMProvider and AI_MODELS.

---

# Runtime Behavior

* Switching Teacher Profile affects the very next chat response.
* No lesson reset required.
* No per-lesson override (v1).
* No per-chat override (v1).
* Global account-level identity only.

---

# Default Strategy

If:

* User has no selected profile
* Profile missing
* Profile disabled

→ Use system-configured default Teacher Profile.

Default is resolved at configuration level, not stored per user.

---

# UI Behavior

Location:
Account → Teacher Profile (existing tab)

User selects exactly one profile.

Selection:

* Single select
* Immediate save (recommended) or explicit save
* Toast confirmation
* Change applies instantly to subsequent chat calls

In Chat UI:
Display current Teacher Profile label near chat header.

---

# Acceptance Criteria

* TeacherProfiles collection exists
* `systemPrompt` strictly a relationship to Prompts
* Only enabled profiles selectable/resolvable
* UserSettings.teacherProfile works 1:1
* UserSettings auto-created on signup
* Teacher Profile injected in correct system prompt order
* Injection excluded from memory/vector pipelines
* Switching profile changes behavior immediately
* Adaptive engine and other subsystems unaffected
* Chat behaves as the selected teacher identity
