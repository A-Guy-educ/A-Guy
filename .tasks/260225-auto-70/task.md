# Task

## Issue Title

Teacher Persona Selection
## Objective

Implement a **global teacher persona selection**:

* Selectable during registration/onboarding (optional).
* Editable anytime in user profile.
* Affects **all student-facing chat surfaces** only (tone/pedagogy via prompt injection).
* Does NOT affect adaptive engine, study plans, tests, or admin chat.

Persona works by injecting a `<teacher_persona>` block into the existing step‑1 system prompt.

---

# Personas (Stored in Payload → Prompts, type: persona)

All personas are stored in Payload as `Prompts` entries (type: `persona`, unique `slug`, indexed). Not hardcoded. Orchestrator fetches by slug at runtime.

## persona_strict

You are a strict but fair math teacher.
You demand full solutions, not just final answers.
You do not accept vague reasoning.
If the student skips steps, ask them to complete the reasoning.
If the student avoids trying, push them to attempt before helping.
You maintain high standards and academic seriousness.
Tone: direct, firm, respectful. Never insult. Never discourage. Encourage responsibility and effort.

## persona_thorough

You are a thorough math teacher who explains until understanding is clear.
If a mistake appears, break the problem into smaller steps.
Explain from multiple angles if needed.
Ask guiding questions frequently.
Repeat key principles in different forms.
Tone: patient but persistent. Goal: deep understanding, not speed.

## persona_patient

You are a calm, supportive, and emotionally aware math teacher.
Adapt the pace to the student.
Normalize mistakes as part of learning.
Encourage effort before correcting.
Provide reassurance when confusion appears.
Tone: gentle, encouraging, confidence-building. Focus on psychological safety.

## persona_focused (DEFAULT)

You are an efficient and goal-oriented math teacher.
Focus only on what is required for solving the problem.
Avoid unnecessary theory.
Highlight key techniques and exam-relevant shortcuts.
Keep explanations concise and structured.
Tone: clear, practical, time-aware. Prioritize performance and exam readiness.

## persona_challenging

You are a challenging math teacher who pushes students to think deeply.
After solving, ask "why" and "what if" variations.
Increase difficulty gradually.
Encourage independent reasoning.
Delay giving full solutions unless necessary.
Tone: stimulating, intellectually demanding. Goal: growth and higher-level thinking.

---

# Data Model

## UserPreferences (NEW)

* 1:1 relationship with `Users` (Payload 3.x `join`).
* Field: `teacherPersona` → relationship to `Prompts` (filtered by `type: persona`).
* Row-level security:

  * Users can read/update only their own record (`user: { equals: user.id }`).
  * Admins full access.
  * `create/delete` restricted to admins/internal.

## Prompts (UPDATE)

* Add `type: persona`.
* Add `slug` (unique + indexed).
* Seed 5 personas listed above.

---

# Registration Flow

* Show 5 persona cards (single select).
* Skip allowed.
* Continue button.
* If skipped → assign `persona_focused`.
* Persist immediately (cookie + DB when available).
* UI: shadcn (`Card`, `Button`, `RadioGroup`), RTL-first Tailwind.
* Interactive components = Client Components.

---

# Anonymous Support

* Store selection in short-lived cookie (NOT localStorage).
* Must survive refresh and OAuth redirects.
* On registration (including OAuth), migrate cookie persona into `UserPreferences.teacherPersona`.

Resolution order:

1. Logged-in valid `UserPreferences.teacherPersona`
2. Valid cookie
3. Fallback → `persona_focused`

If persona invalid/missing → fallback to default.

---

# Profile Settings

* User can view and change persona anytime.
* Uses Server Actions for mutation.
* Confirmation via shadcn `useToast`.
* Changes apply immediately to subsequent chat messages (no lesson reset).

---

# Chat Orchestrator Integration

For every student-facing chat request:

* Fetch persona content from Payload by slug.
* Append inside existing step‑1 system prompt:

```xml
<teacher_persona>
[Full persona text]
</teacher_persona>
```

Rules:

* Append, do NOT replace base prompt.
* Must not be passed to memory-extraction or vector-search steps.
* Must use existing `UnifiedLLMProvider` and `AI_MODELS`.
* Applies immediately across all student chat surfaces, including mid-lesson.

---

# UI Visibility

* Display current persona label near chat.
* All strings via `next-intl` (`useTranslations`).

---

# Acceptance Criteria

1. `UserPreferences` exists (1:1 with Users) with `teacherPersona` relationship.
2. `Prompts` supports `type: persona` + unique indexed `slug`.
3. All 5 personas exist in DB.
4. Registration allows select or skip (default = persona_focused).
5. Anonymous persona stored in cookie and migrated on registration.
6. Profile allows change anytime with toast confirmation.
7. Persona injected inside step‑1 system prompt using `<teacher_persona>` XML.
8. Injection excluded from memory/vector pipelines.
9. Switching persona changes subsequent responses immediately.
10. Persona label visible in chat.
11. Adaptive engine, tests, study plans, admin chat remain unaffected.

---

# Definition of Done

* Registration implemented.
* Profile setting implemented.
* Prompt injection working across all student-facing chat surfaces.
* QA confirms visible behavioral differences per persona.
* Persona text fully editable via Payload without code changes.
