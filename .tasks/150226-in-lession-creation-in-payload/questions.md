# Clarification Needed: 150226-in-lession-creation-in-payload

I have some questions about the requirements. Please answer each question:

## Implementation

1. **Question:** What implementation strategy should we use to make chapter relationship options display `"<chapter title> — <course title>"`?
   - **Option A (recommended):** Add a denormalized text field on `chapters` (e.g. `adminTitle`) and set `chapters.admin.useAsTitle` to that field; keep it updated via hooks + backfill.
   - **Option B:** Customize the `lessons.chapter` relationship field UI component to render labels by looking up course titles.
   - **Your answer:** \_\_\_

## Behavior

2. **Question:** Are `chapter` and `course` titles localized (i18n), and should the label reflect the current admin locale?
   - **Option A:** Not localized / single locale only.
   - **Option B:** Localized; label should use the active locale values.
   - **Your answer:** \_\_\_

3. **Question:** Confirm the exact label formatting.
   - **Option A:** Exactly `<chapter title> — <course title>` (spaces + em dash).
   - **Option B:** Use a plain hyphen `-` or other delimiter.
   - **Your answer:** \_\_\_

## Data / Tenant Safety

4. **Question:** Is this project multi-tenant, and if so what field(s) define tenant boundaries for `courses` / `chapters` / `lessons`?
   - **Option A:** Not multi-tenant.
   - **Option B:** Multi-tenant via a `tenant` field (or similar) on these collections.
   - **Option C:** Multi-tenant via a plugin/custom access layer (please name it / field).
   - **Your answer:** \_\_\_

## Backfill / Updates

5. **Question:** What backfill mechanism is preferred to satisfy "existing chapters show the combined label immediately after deployment"?
   - **Option A:** Use a Payload migration / script that runs once and populates the new field.
   - **Option B:** Backfill on server start (idempotent job).
   - **Option C:** Another existing job runner in this repo (please specify).
   - **Your answer:** \_\_\_

6. **Question:** When a course title changes, how strict must the update timing be for chapter labels?
   - **Option A:** Synchronous (course save waits until all related chapter labels updated).
   - **Option B:** Asynchronous but fast (eventual consistency is OK, e.g. queued job).
   - **Your answer:** \_\_\_

## Location

7. **Question:** Confirm the `lessons` field name and shape.
   - **Option A:** `chapter` (single relationship to `chapters`).
   - **Option B:** `chapters` / other name, or `hasMany` relationship.
   - **Your answer:** \_\_\_

## Your Answers

Please reply with your answers, numbered 1, 2, 3...
