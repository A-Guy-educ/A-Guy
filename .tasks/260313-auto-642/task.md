# Task

## Issue Title

View and Safely Edit Full Exercise JSON in Admin
**Priority:** P4
**Mode:** full

**Description:**
Enable authorized administrators to view and safely edit the content values of an entire exercise via its complete JSON payload, enforcing strict structural protection to prevent configuration errors.

**Core Requirements**
* **Access Control:** This "Full Exercise JSON Edit" feature must be exclusively available to users with the specific role of "Advanced Content Editor" (עורך תוכן מתקדם).
* **Full Exercise Scope:** Authorized users must be able to access a "Raw Data" text view that displays the JSON configuration for the *entire* exercise.
* **Free-Text Editing with Strict Backend Validation:** 
    * The interface allows the user to freely type and edit the JSON text.
    * Upon attempting to save, the system must strictly validate that **only content values** were modified (e.g., text, labels, explanations, instructions).
    * The system must strictly forbid and reject any structural changes. Validation must fail if the user attempted to: add keys, remove keys, rename keys, change array/object hierarchies, alter data types, or delete required fields.
* **Validation & Error Handling:** 
    * If the edited JSON contains syntax errors, invalid formatting, or any structural alterations, the save operation must be explicitly blocked, and the system must display a clear error message.
* **Discarding Changes (Rollback):** If validation fails, the invalid version must not overwrite the existing exercise. If the user cancels or closes the view, the system must automatically revert to the exact previous valid JSON state.
* **End-User Presentation:** Successfully saved content changes must immediately dictate the rendering behavior of the exercise for end-users, without exposing the raw data.

**Acceptance Criteria:**
- [ ] Admin with "Advanced Content Editor" role can open the full JSON view of an exercise.
- [ ] Admin can edit text/content values inside the JSON editor.
- [ ] Attempting to save structurally modified JSON fails (e.g., added/removed keys, changed types).
- [ ] Attempting to save invalid JSON syntax fails.
- [ ] Upon failed validation, a clear error message is displayed.
- [ ] Canceling or failing to save reverts the JSON to its last valid state without overwriting the database.
- [ ] Valid content-only changes are saved successfully.
- [ ] The rendered exercise correctly reflects the approved changes.

**Context (Extracted Technical Statements):**
- Specifying backend validation methods (schema matching vs. deep-diff algorithms) is an implementation detail.
- Suggested UX/UI enhancements (Syntax highlighting, prettify buttons, inline errors) are considered speculative for the MVP and are left to the implementation phase.
