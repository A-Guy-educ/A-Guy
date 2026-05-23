## Issue #1846: Exercise answer check triggers 400 on /api/agent/chat/stream

### Root Cause
The `sendContextualHelp` function (called when a student answers incorrectly) sends a prompt that includes the full exercise context formatted by `formatExerciseContextMessage` (~2000 chars, capped at `MAX_OUTPUT_LENGTH = 2000` in `src/infra/llm/exercise-context.ts`). This is wrapped with a prefix (~50 chars) and suffix (~200 chars), producing a prompt of ~2250 chars.

The backend Zod schema in `src/server/payload/endpoints/agent/chat/request-validation.ts` had `message.max(1000)`, causing the server to return HTTP 400 for any contextual help request.

Normal user messages (typed into the chat input) are typically <1000 chars, so they never triggered this bug.

### Fix Applied
Changed `message.max(1000)` → `message.max(5000)` in `chatRequestSchema`. This accommodates:
- Exercise context: up to 2000 chars (formatExerciseContextMessage MAX_OUTPUT_LENGTH)
- Prefixes/suffixes: ~250 chars
- Total ~2250 chars for contextual help prompts

The frontend already allowed up to 5000 chars (no explicit enforcement on the input).

### Files Changed
- `src/server/payload/endpoints/agent/chat/request-validation.ts` — Zod schema max increased 1000→5000
- `tests/unit/server/services/api-service.test.ts` — Added regression test for 400 error handling

### Verification
- All 3264 unit tests pass (243 test files)
- TypeScript typecheck passes
- ESLint passes (no new warnings)

### Follow-up
Add an integration test that calls `/api/agent/chat/stream` with a >1000 char message to directly verify the schema change (see `.kody/tasks/1846/followups.json`).
