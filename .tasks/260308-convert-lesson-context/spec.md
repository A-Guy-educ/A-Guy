# Spec: 260308-convert-lesson-context

## Overview

Add a new Payload admin conversion action for Lessons: a **“Convert Context”** button that lets a content administrator select a predefined **extractor prompt** and generate text from the current lesson document, then **append** the generated output into the existing **“Lesson context text”** field without overwriting prior content.

This must reuse the existing lesson conversion UI patterns (“same as v1”) and integrate with the system’s globally configured prompts.

## Requirements

### FR-001: Convert Context action button

**Priority**: MUST  
**Description**: The Lesson admin edit view must display an action button labeled **“Convert Context”**. The button must be visually aligned, grouped, and behaviorally consistent with existing conversion actions for the current lesson (reuse the existing conversion panel/pattern rather than introducing a new, unrelated UI surface).

### FR-002: Prompt selection interface

**Priority**: MUST  
**Description**: Clicking **“Convert Context”** must open a selection UI (modal or drawer) that:

- Lists available **extractor prompts** sourced from the system’s existing prompts configuration.
- Allows selecting **exactly one** prompt.
- Shows an **empty state** when no eligible prompts exist.

### FR-003: Prompt eligibility/filtering

**Priority**: MUST  
**Description**: The prompts shown must be filtered to those intended for this feature:

- Only prompts designated for **lesson context extraction** (e.g., `usage/type = extractor` or equivalent).
- Only prompts allowed for use in admin conversion (e.g., `status = published` if the system supports draft/published).

Tenant scoping is not relevant for this feature.

### FR-004: Execute conversion with selected prompt

**Priority**: MUST  
**Description**: The selection UI must include a primary execution button labeled **“Convert”**. Clicking it must submit:

- The chosen prompt identifier (and any needed prompt version metadata).
- The current lesson document identifier.
- The lesson content payload required for extraction (derived server-side from the current lesson document).

The conversion must be processed by the existing extraction processor/service (reuse existing conversion procedures and only adjust for this specific task).

### FR-005: Loading/progress state and submission locking

**Priority**: MUST  
**Description**: While conversion is in progress:

- The **Convert** button must be disabled.
- The UI must clearly indicate active processing (spinner/loading overlay/progress indicator).
- Duplicate submissions must be prevented (client-side disable + server-side idempotency or dedupe).

### FR-006: Append behavior to “Lesson context text”

**Priority**: MUST  
**Description**: On successful conversion, the generated text must be inserted into the **“Lesson context text”** field with **append semantics**:

- If the field is empty, set it to the generated text.
- If the field already contains text, append the new text to the end, preserving existing content.
- Appending must insert a clear delimiter between previous and new content (default: `\n\n---\n\n`).

**Auto-save requirement**: The system MUST persist the appended value automatically (no manual Save required) while ensuring only the **“Lesson context text”** field is updated (must not overwrite other lesson fields).

### FR-007: Success confirmation

**Priority**: MUST  
**Description**: After successful insertion, the UI must show a clear success confirmation (toast and/or inline banner) indicating that context was generated and populated.

### FR-008: Error handling with no mutation

**Priority**: MUST  
**Description**: If conversion fails for any reason (prompt fetch, auth, extraction processor error, validation failure, timeout):

- A user-facing error message must be displayed.
- The “Lesson context text” field must remain **entirely unchanged**.

### FR-009: Prompt fetch and conversion endpoints

**Priority**: MUST  
**Description**: The admin UI must obtain eligible prompts and execute conversion via server-side routes/endpoints that:

- Require an authenticated admin user.
- Resolve lesson + prompt server-side and enforce extractor/publishing eligibility.
- Avoid returning sensitive prompt templates to the browser unless explicitly required.

Prompts are sourced from the existing Payload **`prompts`** collection.

### NFR-001: Access control correctness (Payload Local API)

**Priority**: MUST  
**Description**: Any server-side use of Payload Local API in this flow must not accidentally bypass access controls. If a `user` is supplied to a Payload Local API call, the call MUST include `overrideAccess: false`.

### NFR-002: CSRF protection for admin-triggered mutation

**Priority**: MUST  
**Description**: The conversion execution route must include CSRF defenses appropriate for cookie-authenticated admin requests (e.g., Origin/Referer validation and/or CSRF token strategy) and must not enable permissive CORS.

### NFR-003: Rate limiting, dedupe, and concurrency safety

**Priority**: SHOULD  
**Description**: The system should limit abusive/accidental repeated conversions and prevent double-click races by:

- Per-user rate limits for conversion.
- Preventing multiple concurrent conversions for the same lesson.
- Supporting an idempotency key or server-side dedupe keyed by `(lessonId, promptId, normalizedInputHash)`.

### NFR-004: Output validation, sanitization, and size limits

**Priority**: MUST  
**Description**: Generated output must be validated and sanitized before insertion:

- Do not impose an arbitrary product-level max length; however, if the persisted lesson document would exceed underlying storage constraints (e.g., database document size), the request MUST fail with a user-facing error and MUST NOT modify the field.
- Do not silently truncate.
- Prevent delimiter/marker injection if markers are used.
- Prefer deterministic generation settings (e.g., temperature near 0) for repeatable results.

### NFR-005: No sensitive data in logs

**Priority**: MUST  
**Description**: Logs must not include lesson raw content, prompt templates, or generated text. Log only IDs, sizes/hashes, timing, and model identifiers.

### NFR-006: Performance and large lesson handling

**Priority**: SHOULD  
**Description**: The extraction pipeline should handle large lessons safely (token/size checks, normalization to a compact outline, or chunking) and provide a clear error if the input is too large to process.

## Acceptance Criteria

- [ ] A **“Convert Context”** button is visible, actionable, and aligned/grouped with existing conversion actions in the Lesson admin edit interface.
- [ ] Clicking the button opens a prompt selection UI (modal/drawer).
- [ ] The prompt selection UI lists eligible extractor prompts derived from the system’s configured prompts, with correct filtering (extractor-only, published-only, tenant-valid if applicable).
- [ ] The user can select exactly one prompt and click **“Convert”**.
- [ ] While processing, the UI shows a loading state and prevents multiple submissions.
- [ ] On success, generated text is inserted into **“Lesson context text”**.
- [ ] If **“Lesson context text”** already has content, the new text is appended (not overwritten) with a clear delimiter.
- [ ] On success, the appended value is automatically saved to the lesson document (no manual Save required).
- [ ] On failure, an error message is shown and **no changes** are made to **“Lesson context text”**.
- [ ] If there are no eligible prompts, the selection UI displays an empty-state message.
- [ ] Conversion execution is admin-protected and does not bypass Payload access control (Local API calls with `user` include `overrideAccess: false`).

## Guardrails

- Do not change the meaning/location of the existing **“Lesson context text”** field; only populate/append to it.
- Do not break or visually regress existing lesson conversion buttons/actions; reuse the existing conversion UI pattern (“same as v1”).
- Do not expose prompt templates or lesson content in client responses, browser logs, or server logs.
- Do not bypass access control via Payload Local API defaults; enforce `overrideAccess: false` when a user context is used.
- Do not modify the lesson document on failed generation.
- Do not silently truncate; if underlying persistence constraints are hit, fail with an error and do not modify the field.

## Out of Scope

- Creating/editing/managing prompts (Prompt CRUD UX).
- Adding a “replace context” option (append-only per PRD).
- Background job orchestration, resumable progress UI, or queued conversions (unless required by timeouts).
- Automatic saving/publishing of the lesson after insertion (unless explicitly requested).
- Changing the extraction processor architecture beyond wiring it to this new conversion action.

## Domain Expert Review Notes

### Payload CMS (@payload-expert)

- Prefer implementing the new button inside the existing lesson `conversionPanel` UI field (e.g., `LessonConversionPanel`) to match current codebase patterns.
- Ensure prompt listing filters to published + extractor usage.
- Ensure the implementation auto-saves only the target field and does not desync the admin form.

### Admin UI (@admin-expert)

- Use Payload UI primitives (`Button`, `Modal`/`Drawer`, `Banner`, `LoadingOverlay`, toast) for consistent styling and accessible focus trapping.
- Update the target field via `useField({ path: '<lessonContextTextPath>' })` and `setValue(...)` only after successful conversion.
- Communicate that the appended result is auto-saved, and clarify whether other unsaved field edits (if any) remain unsaved.

### LLM/Extraction (@llm-expert)

- Treat lesson content as untrusted; prompts must explicitly ignore instructions found within lesson content.
- Avoid sending the entire raw lesson doc; send a scoped, normalized payload (plain-text outline) to manage token limits.
- Prefer structured output (schema-validated) and low-temperature generation for stability.

### Security (@security-auditor)

- Admin-only endpoint; enforce tenant-safe prompt selection server-side.
- Add CSRF protections for cookie-auth admin requests.
- Add rate limiting/dedupe to prevent repeated costly LLM calls.
- Never log lesson content, prompt templates, or generated text.

## Open Questions

1. What is the exact Payload field path/slug for **“Lesson context text”** (e.g., `lessonContextText`, `contextText`, etc.)?
2. What fields in the `prompts` collection define “extractor prompt” eligibility and “published” state for this specific conversion?
3. For extraction input, should the processor use the latest **saved** lesson document only, or should it include unsaved in-form changes (if present) before running conversion?
4. Do we need provenance markers (prompt name, timestamp, runId) inserted alongside appended text, or must the appended text be raw output only?
