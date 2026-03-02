#+#+#+#+################################################################################
# Spec: 260302-auto-25
## (SPEC-ONLY — no code changes in this stage)
################################################################################

## Overview

Update the existing **study plan** feature so that study plans are **generated only when the user manually triggers generation** (instead of auto-generating implicitly), and so that all schedule/date calculations are **anchored to the exam date** (a 7-day window ending on the exam date) rather than based on “today”.

## Requirements

### FR-001: Manual generation trigger (UI)

**Priority**: MUST
**Description**: Provide a user-facing control (e.g., “Generate study plan”) that the user explicitly clicks/taps to start study-plan generation. The UI must clearly communicate eligibility (enabled/disabled), progress, and result.

### FR-002: Manual generation trigger (server/API)

**Priority**: MUST
**Description**: Provide an authenticated server-side entry point to generate a study plan (e.g., Next.js Route Handler or Payload custom endpoint). The endpoint must:

- Run generation for the authenticated user only
- Validate inputs (including exam date presence/format)
- Create or update the relevant study-plan record
- Return a predictable success/error payload for UI consumption

### FR-003: Remove/disable all automatic generation behaviors

**Priority**: MUST
**Description**: The system must no longer generate study plans automatically due to implicit triggers (e.g., page load, login, saving an exam, or other background behavior). Generation must only occur via the explicit manual trigger.

### FR-004: Exam-anchored 7-day planning window

**Priority**: MUST
**Description**: Study-plan date calculations must be anchored to the exam date and define a 7-day window ending on the exam date:

- **windowEnd** = exam date (D0)
- **windowStart** = exam date minus 6 calendar days (D-6)
- The plan covers each day in the window (D-6, D-5, …, D0)

If the exam is fewer than 7 days away at generation time, the system must generate a **partial window** that does not include days in the past:

- **windowStart** = max(today, exam date − 6 days)

If the exam date is in the past, generation must be rejected with a user-friendly error.

### FR-005: Stable window semantics (no “today-based drift”)

**Priority**: MUST
**Description**: Once a study plan is generated for a given exam date/window, the plan’s window boundaries must be stored and used for display and downstream logic, avoiding day-to-day drift caused by recalculating based on “today”.

### FR-006: Idempotency and concurrency safety

**Priority**: MUST
**Description**: Repeated manual triggers (including double-clicks and retries) must not create duplicate study plans for the same user/exam window. The system must ensure one of the following behaviors (implementation choice):

- **Idempotent upsert**: generate/update the existing plan for the same `owner + examDate` (or derived unique key), OR
- **Single active generation**: prevent concurrent generation with a “generating” state and return a consistent response.

### FR-007: Clear handling when a plan already exists

**Priority**: SHOULD
**Description**: If a study plan already exists for the same exam window, the UI should:

- Prefer showing the existing plan
- Disable or change the CTA to “View plan”
- If regeneration is supported, provide a secondary “Regenerate” action with appropriate warnings

### FR-008: Ownership and access control

**Priority**: MUST
**Description**: Study plans must be user-owned. Only the owner (and optionally admins) may generate, view, or modify their plan(s). The system must not allow a user to generate or access another user’s study plan.

### FR-009: Input validation and error messaging

**Priority**: MUST
**Description**: Generation must fail fast with actionable errors for:

- Missing exam date
- Invalid exam date format
- Exam date in the past
- Any other required inputs missing for generation

UI-facing messages must be i18n-friendly (keys for all supported locales) and should avoid leaking internal errors.

### FR-010: Persist minimal generation metadata

**Priority**: SHOULD
**Description**: Persist metadata to support debugging and UI state, such as:

- `generatedAt`
- `windowStart` / `windowEnd`
- `status` (e.g., `idle | generating | generated | failed`)
- Optional `lastError` (redacted) for admin debugging
- Optional `generationVersion` to track algorithm changes

### NFR-001: Security hardening for generation endpoint

**Priority**: MUST
**Description**: The generation entry point must be protected against common web risks:

- Auth required; return 401 if unauthenticated
- Authorization enforced by ownership
- Server must derive `owner` from authenticated user (never trust client-provided owner/userId)
- Input validation (e.g., Zod)
- No sensitive/internal data in responses
- Use POST (or equivalent) for state-changing operations
- If cookie-based auth is used, include CSRF defenses (Origin/Referer checks and/or CSRF token)

### NFR-002: Rate limiting and abuse prevention

**Priority**: MUST
**Description**: The generation endpoint must be rate-limited (at least per-user and per-IP) and must prevent job spamming (cooldown and/or “one active generation” semantics).

### NFR-003: Timezone correctness

**Priority**: MUST
**Description**: “Day” boundaries used for D-6..D0 must be defined consistently (user timezone vs system timezone) and applied consistently for:

- Calculating `windowStart/windowEnd`
- Determining “today” for partial-window behavior
- Displaying dates in the UI

### NFR-004: Observability

**Priority**: SHOULD
**Description**: Log generation attempts (userId, timestamp, requestId, outcome) without logging sensitive plan content. Provide enough telemetry to diagnose failures and measure usage.

## Acceptance Criteria

- [ ] A study plan is **not** generated automatically by background/implicit triggers; it is generated **only** by an explicit manual user action.
- [ ] Triggering generation creates/updates a study plan whose window is **anchored to the exam date** and spans **7 days ending on the exam date** (D-6..D0), with a partial window when the exam is <7 days away.
- [ ] If the exam date is missing/invalid, the UI and API return clear, actionable errors; generation does not proceed.
- [ ] If the exam date is in the past, generation is rejected with a user-friendly error.
- [ ] Repeated clicks/retries do not create duplicates; generation is idempotent and/or concurrency-safe.
- [ ] A user cannot generate, read, or modify another user’s study plan (ownership enforced).
- [ ] The generation endpoint is authenticated, validates inputs, is rate-limited, and does not leak sensitive/internal data.
- [ ] After successful generation, the UI reflects the new plan without requiring a full manual reload (consistent refresh behavior).

## Guardrails

- Do not introduce any new automatic or background generation behavior.
- Do not change unrelated collections/features outside the study-plan domain.
- Do not loosen access control; maintain or strengthen ownership-based authorization.
- Do not return internal prompts, provider payloads, stack traces, or other sensitive metadata to non-admin clients.
- Preserve existing study-plan data shape/semantics where possible; if schema changes are required, they must be backward compatible or include a migration plan.

## Out of Scope

- Changing the pedagogical/AI logic of *what* the study plan contains (content quality improvements) beyond adapting to the new date window.
- Adding multi-exam/multi-window scheduling (multiple concurrent exam plans) unless already supported.
- Building a full exam-date editor UI (beyond minimal affordances to fix missing/invalid date).
- Notifications, reminders, calendar integrations.

## Open Questions

1. **Source of exam date**: Where is the authoritative exam date stored today (which collection/field), and is it a date-only value or a full datetime?
2. **Timezone definition**: Are window calculations based on the user’s locale/timezone, a course timezone, or server timezone?
3. **Eligibility to generate**: Can users generate the plan **before** the 7-day window begins (precompute), or should the button be disabled until `windowStart`?
4. **Regeneration policy**: If a plan exists for the same exam window, should regeneration overwrite it, merge, or be disallowed?
5. **Uniqueness model**: Is the intended uniqueness per `owner + examDate`, per `owner + examId`, or something else (e.g., course + exam)?
6. **Plan persistence**: Is the plan stored as structured day-by-day tasks, rich text, JSON blocks, or derived on read? (Affects idempotency and UI refresh behavior.)

## Domain Expert Feedback (incorporated)

### Payload expert notes

- Prefer implementing generation as an authenticated endpoint (Next.js route handler or Payload custom endpoint) rather than collection hooks; keep pure generation logic in a reusable server function.
- Enforce ownership at the collection access level with row-scoped query constraints; when using Local API with `user`, set `overrideAccess: false`.
- Consider storing `owner`, `examDate`, `windowStart`, `windowEnd`, `generatedAt`, `status`, and optional `generationVersion/lastError`.
- Plan for concurrency/idempotency (double-click race) using upsert or a `generating` state.

### Web expert notes

- Place the “Generate study plan” CTA in the existing study-plan section (empty state/header). Show status/errors adjacent to the CTA; handle RTL layout.
- Provide clear disabled-state explanations, loading states, and a post-generate refresh (e.g., `router.refresh()` / revalidation).
- Ensure all user-facing strings are localized (next-intl), and date formatting is locale-aware.

### Security auditor notes

- Authenticate every request; authorize strictly by ownership; never accept/act on a client-provided `userId/owner`.
- Validate inputs, rate-limit per user/IP, and prevent repeated job spamming.
- Avoid ID enumeration and data leakage in errors/responses; ensure CSRF defenses if cookie-based auth is used; do not allow GET to trigger generation.
