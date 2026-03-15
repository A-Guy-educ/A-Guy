# Spec: 260310-auto-320

## Overview

Add a role-gated "Raw Data" editor in the Payload Admin panel that lets authorized users view and edit the JSON payload of a single content block, while strictly preventing any changes to the block's JSON structure. Saving must update only the selected block; invalid edits must be blocked and safely discarded on cancel.

## Requirements

### FR-001: Role-gated availability (Advanced Content Editor only)

**Priority**: MUST
**Description**: The "Raw Data" / raw JSON edit option must be visible and usable **only** to users with the role **Advanced Content Editor** (Hebrew label: **עורך תוכן מתקדם**). Users without this role (including "standard administrators or editors") must not see the option and must be blocked from using the capability even if they attempt to call underlying APIs directly.

### FR-002: Per-block scoped raw data view

**Priority**: MUST
**Description**: Authorized users must be able to open a raw data editor scoped to a single, currently selected block. The editor must clearly indicate which block is being edited (e.g., block id and/or block type).

**Note**: For Exercises, the content is stored in a custom `json` field with Zod-validated structure. The existing `ExerciseContentEditor` component has a `JSONInspector` that can be enhanced with role-gating and structure invariance. For Pages, the native `blocks` field would require a different integration approach (field-level component override).

### FR-003: Content-only editing (structure locked)

**Priority**: MUST
**Description**: The editor must allow changing **values only** within the existing JSON. It must strictly forbid structural changes, including (at any nesting level):

- Adding keys
- Removing keys
- Renaming keys (equivalent to add/remove)
- Changing any array length (no insert/remove/reorder that changes length)

Additionally, reserved block metadata must be immutable (at minimum: `id` and the block discriminator such as `blockType`/`type`; include any other discriminators used by the project's block model).

### FR-004: JSON parsing + structural invariance validation

**Priority**: MUST
**Description**: The system must validate, before any persistence:

1) The edited payload is valid JSON.
2) The edited payload's structure exactly matches the currently saved structure for that block ("shape invariance").

On failure, saving must be blocked and the UI must display a clear error that indicates whether the failure is JSON syntax vs structural change, and (when structural) surface at least one offending JSON path.

### FR-005: Cancel/close must discard invalid or unapplied edits

**Priority**: MUST
**Description**: If the user closes/cancels the raw editor with invalid edits or without successfully applying changes, the system must revert the editor state to the last saved valid block payload. Invalid edits must not leak into the persisted document or the parent form state.

### FR-006: Block-level isolation on save

**Priority**: MUST
**Description**: A successful save must apply changes **only** to the selected block (matched by block id). All other blocks must remain byte-for-byte unchanged (except for benign server-managed fields like updated timestamps, if applicable). The updated block output must reflect immediately after save.

### FR-007: Server-side enforcement via dedicated patch capability

**Priority**: MUST
**Description**: Structural invariance and authorization must be enforced server-side (not only in the admin UI). Implementation must provide a server-controlled mutation path that:

- Authenticates the caller
- Authorizes the "Advanced Content Editor" role
- Replaces only the targeted block by id
- Rejects any attempt to modify other blocks, reorder blocks, or modify reserved metadata
- Validates structure invariance against the currently stored block payload

If a custom endpoint is used, it must validate request params/body and return appropriate HTTP errors (401/403/400).

### FR-008: Create Advanced Content Editor role

**Priority**: MUST
**Description**: Before the raw JSON editor can be implemented, the "Advanced Content Editor" role must be created and added to the system:

- Add `AccountRole.AdvancedContentEditor = 'advanced_content_editor'` to the AccountRole enum in `src/infra/auth/roles.ts`
- Add Hebrew label: עורך תוכן מתקדם to ACCOUNT_ROLE_LABEL
- Add `saveToJWT: true` so role is available in JWT for fast access checks
- Update Users collection to include this as an option in the role select field
- Grant Admin role implicitly this capability (admins should have access)

**Note**: This is a prerequisite for FR-001. The feature cannot work without this role existing.

### NFR-001: Access control safety with Payload Local API

**Priority**: MUST
**Description**: Any server-side logic that performs Payload Local API operations on behalf of a user must not bypass access control. When passing a `user` to Local API calls, `overrideAccess: false` must be used.

### NFR-002: Security hardening for raw JSON inputs

**Priority**: MUST
**Description**: Server-side input handling must mitigate common raw-JSON risks:

- Reject/strip prototype-pollution keys (`__proto__`, `prototype`, `constructor`) before any merge/spread operations.
- Enforce strict allowlist of updated fields (only the targeted block payload) to prevent mass assignment.

### NFR-003: CSRF and request origin protections for admin mutations

**Priority**: SHOULD
**Description**: If the mutation relies on cookie-based authentication, the server should enforce CSRF protections (e.g., Origin/Referer checks to the admin origin and/or CSRF token header) for the raw JSON patch operation.

### NFR-004: Auditability of dangerous edits

**Priority**: SHOULD
**Description**: Successful raw JSON edits should create an append-only audit record including actor, document id, block id/type, timestamp, and a minimal before/after diff or hashes, suitable for incident response.

### NFR-005: Performance and UX responsiveness

**Priority**: SHOULD
**Description**: Validation should run fast enough for interactive editing. The UI should disable "Apply/Save" while invalid and avoid unnecessary full-form re-renders when editing raw JSON.

### NFR-006: Role creation prerequisite

**Priority**: MUST
**Description**: The Advanced Content Editor role must be created before implementing FR-001. See FR-008 for the required role creation steps.

## Acceptance Criteria

- [ ] Advanced Content Editor role exists in the system (FR-008 completed).
- [ ] Only users with the "Advanced Content Editor" role (עורך תוכן מתקדם) can see and access the per-block "Raw Data" JSON edit option.
- [ ] The JSON edit view opens scoped only to the currently selected block and identifies which block is being edited.
- [ ] Users can edit JSON values within the existing structure.
- [ ] The system validates that JSON is syntactically valid.
- [ ] The system validates that JSON structure is unchanged (keys and array lengths) and blocks any save when structure differs.
- [ ] When validation fails, save is prevented and an error message is shown (syntax vs structure; includes at least one offending path for structure errors).
- [ ] Closing/canceling the edit view with invalid or unapplied changes reverts the editor to the previously saved valid state and does not persist changes.
- [ ] Saving valid edits updates only the targeted block (by id) and leaves all other blocks unchanged.
- [ ] Authorization and structure invariance are enforced server-side (not only by UI visibility).

## Guardrails

- Do not add the feature for any role other than "Advanced Content Editor".
- Do not introduce broader JSON editing of entire documents or multiple blocks at once.
- Do not allow structural edits (no key add/remove, no array length changes).
- Do not change block identity/discriminator fields (`id`, `type`/`blockType`, and any other structural metadata).
- Do not modify unrelated admin UI/UX enhancements that were explicitly excluded (syntax highlighting, prettify, copy button, reset button), unless separately requested.

## Out of Scope

- Syntax highlighting, JSON prettify/format, copy-to-clipboard, and explicit reset buttons (non-MVP per task context).
- Introducing a general-purpose JSON editor for non-block fields.
- Redesigning the block editing experience beyond adding a scoped raw data editor.
- Solving collaboration/concurrency beyond basic last-write-wins semantics (unless explicitly required).

## Domain Expert Feedback

### @payload-expert

- Model the role as a stable machine value in `users.roles` with `saveToJWT: true` (Hebrew label for admin UI).
- Enforce structure invariance by comparing against `originalDoc` in `beforeValidate`/`beforeChange` hooks (or equivalent server path), not solely via schema validation.
- Consider a dedicated "patch block by id" server operation that reads the latest doc, replaces only the targeted block, and validates invariance.

### @admin-expert

- Best integration point is the existing/custom block editor UI (if present); otherwise override the field UI for a `blocks` field.
- Keep edits local until Apply; Cancel must discard state.
- Prefer UX that reduces accidental structure edits; if using a textarea, provide clear validation and error messaging.

### @security-auditor

- UI-only gating is insufficient; enforce authorization and invariants on the server.
- Prevent mass assignment by accepting only the targeted block payload, not whole-document updates.
- Mitigate stored XSS risks for HTML/SVG-like fields with server-side sanitization or strict validation (as applicable to the project's block types).
- Add CSRF protections for cookie-authenticated admin mutations; add audit logging for successful edits.

## Open Questions (ANSWERED)

1) Does the "Advanced Content Editor" role already exist in the users role system?
   **ANSWER**: NO. The system only has two roles: Admin and Student. FR-008 creates this role.

2) Which collection(s) contain the relevant blocks (Exercises, Pages, Posts)?
   **ANSWER**: Exercises uses a custom `json` field with Zod validation and has existing JSONInspector. Pages uses native `blocks` field. Posts uses Lexical richText (not applicable).

3) Are drafts/versions enabled for the target collections?
   **ANSWER**: Yes - Pages and Posts have drafts enabled. Exercises does not have explicit versions.

4) Which block types can contain HTML/SVG/URLs that require server-side sanitization?
   **ANSWER**: Exercises has `html` block with existing sanitization. SVG blocks have interactive elements.

5) Should the server operation require optimistic concurrency?
   **ANSWER**: RECOMMEND - Add `updatedAt` matching to reduce accidental overwrites.
