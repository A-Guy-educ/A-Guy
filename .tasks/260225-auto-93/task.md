# Task

## Issue Title

Teacher Profile
# Teacher Profile – Chat Identity Specification (v1.1)

## Core Principle

The chat **is the teacher**.

The selected Teacher Profile defines the behavioral identity of the chat for every student-facing request.
The selected profile must always be included in the system context sent to the model.

---

## Scope

### Affects

* All student-facing chat surfaces
* Tone, pedagogy, instructional behavior (via system prompt injection)

### Does NOT Affect

* Adaptive engine
* Study plans
* Tests
* Admin chat
* Memory extraction pipeline
* Vector search pipeline

---

## Data Model

### Collection: TeacherProfiles

Fields:

* `slug` (unique, indexed)
* `label` (display name)
* `description` (short UI explanation)
* `systemPrompt` → relationship to `Prompts` (**required; no text-field alternative**)
* `isEnabled` (boolean)

Clarifications:

* `systemPrompt` MUST be a relationship to `Prompts`.
* Only profiles where `isEnabled = true` are selectable and resolvable.
* No `order`.
* No `isDefault` flag.
* Default profile is controlled at configuration level.

### UserSettings (1:1 with User)

Field:

* `teacherProfile` → relationship to `TeacherProfiles`

Access:

* User can read/update only own record
* Admin full access
* Create/delete restricted

Clarification:

* `UserSettings` must be automatically created on user signup (hook-based or equivalent transactional mechanism).

---

## Guest Behavior (v1)

* Teacher Profile applies to authenticated users only.
* Guests always use the configured default profile.

---

## Chat Orchestrator Integration

### Step 1 — Resolve Teacher Profile

1. Load `UserSettings.teacherProfile`.
2. If null, missing, or disabled → fallback to configured default profile.
3. Fetch full `TeacherProfiles` entity.
4. Load its related `systemPrompt` content.

### Step 2 — Build System Context (strict order)

System context MUST follow this order:

1. `<Base system prompt>`
2. `<teacher_profile>` block
3. Lesson / course context

Structure:

```text
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
* Must use existing `UnifiedLLMProvider` and `AI_MODELS`.

---

## Runtime Behavior

* Switching Teacher Profile affects the very next chat response.
* No lesson reset required.
* No per-lesson override (v1).
* No per-chat override (v1).
* Global account-level identity only.

---

## Default Strategy

If:

* User has no selected profile
* Profile missing
* Profile disabled

→ Use system-configured default Teacher Profile.

Default is resolved at configuration level, not stored per user.

---

## UI Behavior

Location:

* Account → Teacher Profile (existing tab)

Selection:

* User selects exactly one profile (single-select)
* Immediate save (recommended) or explicit save
* Toast confirmation
* Change applies instantly to subsequent chat calls

In Chat UI:

* Display current Teacher Profile label near chat header

---

## Seeding Requirements (data must exist)

Create:

1. **5 Prompts** entries (raw text) for teacher profiles.
2. **5 TeacherProfiles** entries referencing those Prompts via `systemPrompt` relationship.

Use these slugs:

* `teacher_strict`
* `teacher_thorough`
* `teacher_patient`
* `teacher_focused` (default)
* `teacher_challenging`

Prompt texts (store in `Prompts.template` or equivalent raw text field):

### teacher_strict — Strict Teacher (in a good way)

You are a strict but fair math teacher.
You demand full solutions, not just final answers.
You do not accept vague reasoning.
If the student skips steps, ask them to complete the reasoning.
If the student avoids trying, push them to attempt before helping.
You maintain high standards and academic seriousness.
Tone: direct, firm, respectful.
Never insult. Never discourage.
Encourage responsibility and effort.

### teacher_thorough — Thorough Teacher (when needed)

You are a thorough math teacher who explains until understanding is clear.
If a mistake appears, break the problem into smaller steps.
Explain from multiple angles if needed.
Ask guiding questions frequently.
Repeat key principles in different forms.
Tone: patient but persistent.
Your goal is deep understanding, not speed.

### teacher_patient — Patient & Supportive Teacher

You are a calm, supportive, and emotionally aware math teacher.
Adapt the pace to the student.
Normalize mistakes as part of learning.
Encourage effort before correcting.
Provide reassurance when confusion appears.
Tone: gentle, encouraging, confidence-building.
Focus on creating psychological safety.

### teacher_focused — Focused & Efficient Teacher

You are an efficient and goal-oriented math teacher.
Focus only on what is required for solving the problem.
Avoid unnecessary theory.
Highlight key techniques and exam-relevant shortcuts.
Keep explanations concise and structured.
Tone: clear, practical, time-aware.
Prioritize performance and exam readiness.

### teacher_challenging — Challenging Teacher (extra)

You are a challenging math teacher who pushes students to think deeply.
After solving, ask "why" and "what if" variations.
Increase difficulty gradually.
Encourage independent reasoning.
Delay giving full solutions unless necessary.
Tone: stimulating, intellectually demanding.
Your goal is growth and higher-level thinking.

---

## Acceptance Criteria

* TeacherProfiles collection exists.
* `systemPrompt` is strictly a relationship to Prompts.
* Only enabled profiles are selectable/resolvable.
* UserSettings.teacherProfile works 1:1.
* UserSettings auto-created on signup.
* Teacher Profile injected in correct system prompt order.
* Injection excluded from memory/vector pipelines.
* Switching profile changes behavior immediately.
* Adaptive engine and other subsystems unaffected.
* Chat behaves as the selected teacher identity.

---

## Agent Execution Instruction

Implement end-to-end (data model + seeding + UI + orchestrator wiring) and open a PR.
