## CI Fix for PR #1873 (branch 1849-p2-ask-page-never-finishes-loading-stuck-on-loadin)

### Root Cause of CI Failure
`message-persist.int.spec.ts` returned HTTP 500 instead of 200.

**The prior fix (route.ts)** conditionally includes `contextRef` only when the referenced doc exists — this is correct and was already in the code.

**The remaining bug**: `contextRef` was `required: true` in the Conversations schema. When a conversation is created without `contextRef` (because the doc doesn't exist), the document is created successfully. However, when the `payload.update` call runs later (adding the message), Payload re-validates the document and throws because `contextRef` (a required field) is missing from the stored document.

### Fix Applied
Changed `contextRef` from `required: true` to `required: false` in `src/server/payload/collections/Conversations.ts`.

This is semantically correct: a conversation CAN exist without a specific context reference (e.g., a general chat that isn't tied to a lesson). The `beforeChange` hook already handles `contextRef: undefined` gracefully — it skips the `contextKey` auto-derivation but that's fine since `contextKey` is `required: false`.

### Files Changed
- `src/server/payload/collections/Conversations.ts` — `required: true` → `required: false` on `contextRef`
- `src/payload-types.ts` — regenerated after schema change

### Verification
- Typecheck: ✅
- Lint: ✅ (only pre-existing warnings)
- Unit tests: ✅ (useNotebookChat: 13 tests, api-service: 6 tests)
- Format: ✅

### Why the integration test couldn't be run locally
The `beforeAll` in `message-persist.int.spec.ts` times out in this environment due to slow MongoDB Atlas connectivity. The test's `beforeAll` creates a user, logs in, and queries/creates a lesson — all requiring a live DB connection. The CI environment has faster connectivity, so the test ran to completion there (500 response), confirming the bug.
