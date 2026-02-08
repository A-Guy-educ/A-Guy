---
title: LLP v3 - Remove PDF Verifier Prompt
date: 2026-02-08
owner: minimax
status: ready-to-execute
scope: remove-verifier-only
deprecation_window: 1_release
---

# Low-Level Plan v3 (Final): Remove Verifier Prompt From PDF Conversion

## Context

The PDF-to-exercises conversion flow currently requires two admin-selected prompts:

- Extractor prompt (LLM call per PDF segment)
- Verifier prompt (LLM call per extracted exercise)

The main product goal remains: extract PDF exercises into LaTeX with Hebrew text.
This change is a simplification step: remove the verifier prompt concept entirely (UI/API/job/pipeline/schema) to reduce operational overhead and extra LLM calls.

Important: This plan does NOT add a replacement verifier (hardcoded contract verifier will be a separate plan). This implies a temporary quality regression: more structurally-valid-but-wrong exercises may be persisted.

## Non-Goals

- No hardcoded verifier/contract checks in this plan
- No semantic faithfulness checking against the PDF
- No migration/deletion of existing prompt documents with `usage = verifier`
- No extraction prompt improvements

## Key Decisions / Policy

- Remove `verifier` from allowed `Prompts.usage` options (no new verifier prompts can be created)
- No DB migration: existing verifier prompt docs remain in MongoDB as legacy/orphaned
- Backward compatibility (deprecation window: 1 release):
  - Accept-and-ignore legacy `verifierPromptId` in queue API schema
  - Make legacy verifier fields optional in job input TS types so in-flight queued jobs do not crash
- Deprecation policy: legacy `verifierPromptId` acceptance and optional legacy fields must be hard-deleted in a follow-up change (next release)

## Files In Scope

Source:

- `src/server/payload/jobs/types.ts`
- `src/server/api/schemas/job-schemas.ts`
- `src/server/payload/collections/Prompts.ts`
- `src/server/services/exercise-conversion/helpers.ts`
- `src/server/payload/services/exercise-conversion-service.ts`
- `src/server/payload/jobs/pdf-to-exercises-task.ts`
- `src/app/api/prompts/for-conversion/route.ts`
- `src/app/api/exercises/convert/queue/route.ts`
- `src/ui/admin/PdfConversion/ConversionForm/index.tsx`
- `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`
- `src/i18n/en.json`
- `src/i18n/he.json`
- `src/infra/config/system-params.ts`

Tests:

- `tests/unit/server/services/exercise-conversion/helpers.test.ts`
- `tests/unit/api/schemas/job-schemas.spec.ts`
- `tests/int/jobs-run-now.int.spec.ts`
- `tests/int/exercise-conversion-api.int.spec.ts`

Generated (do not edit manually):

- `src/payload-types.ts` (updated via `pnpm generate:types`)

## Preflight

1. Create a feature branch.
2. Ensure Node/pnpm are available.
3. Ensure MongoDB is running (`pnpm db:start`) and dev server can start (`pnpm dev`).
4. Confirm you can run:

```bash
pnpm -v
pnpm tsc --noEmit
```

## Execution Steps (Do In Order)

### Layer 1: Types & Schemas (backward-compat first)

#### Step 1 - Make verifier job input fields optional (in-flight jobs)

File: `src/server/payload/jobs/types.ts`

Modify `PdfToExercisesInput`:

- In `promptRefs`, change:
  - `verifierPromptId: string` -> `verifierPromptId?: string`
  - Add comment: `// DEPRECATED: legacy field, ignored at runtime. Hard-delete after next release.`
- In `promptSnapshot`, change:
  - `verifier: string` -> `verifier?: string` (same comment)
- In `promptSnapshotHash`, change:
  - `verifier: string` -> `verifier?: string` (same comment)

Do not remove these fields in this PR.

#### Step 2 - Make `verifierPromptId` optional in the queue API request schema

File: `src/server/api/schemas/job-schemas.ts`

Modify `queueConversionSchema`:

- Change:
  - `verifierPromptId: objectIdSchema` -> `verifierPromptId: objectIdSchema.optional()`
- Add comment: `// DEPRECATED: accepted for backward compat, ignored. Remove after next release.`

Rationale: old cached admin UI builds may still POST it; this avoids hard failures.

#### Step 3 - Remove verifier from allowed prompt usage options

File: `src/server/payload/collections/Prompts.ts`

- Remove the `PDF Verifier` option from the `usage` select options.
- Update the nearby comment and description strings to remove references to verifier.

Expected options after change:

```ts
options: [
  { label: 'Chat', value: 'chat' },
  { label: 'PDF Extractor', value: 'extractor' },
]
```

Note: legacy documents with `usage = verifier` remain in DB (no migration).

**Admin UX impact**: Legacy verifier prompts will display with `usage = 'verifier'` in the Prompts collection admin UI, but the field's select dropdown will no longer include that option. This is acceptable; admins can manually delete these documents. Add a follow-up ticket to either:

- Migrate legacy docs to a new `usage = 'legacy_verifier'` (with admin filter to hide them), OR
- Add a data migration to delete them entirely.

### Layer 2: Helpers

#### Step 4 - Remove verifier parsing helper and narrow prompt validation to extractor

File: `src/server/services/exercise-conversion/helpers.ts`

Update `validatePromptForUsageAndTenant` signature:

- Change:
  - `expectedUsage: 'extractor' | 'verifier'`
  - to:
  - `expectedUsage: 'extractor'`

Delete the entire `parseVerifierResponseText` function.

### Layer 3: Service and Job Task

#### Step 5 - Remove verifier prompt from ExerciseConversionService job construction

File: `src/server/payload/services/exercise-conversion-service.ts`

- Remove `verifierPromptId` from `QueueConversionParams` type signature.
- **If the function still receives it** (e.g., via spread or partial params), explicitly ignore it and do NOT pass it to `payload.jobs.queue`.
- Add inline comment: `// verifierPromptId is deprecated; even if present in params, we omit it from job input.`
- Remove verifier prompt fetch + not-found check
- Remove verifier from `promptSnapshot`
- Remove verifier hash computation
- Remove verifier fields from `promptRefs` / `promptSnapshotHash` passed to `payload.jobs.queue`

Resulting queued job input must include only extractor prompt refs/snapshot/hash.

#### Step 6 - Remove verifier call path from the PDF conversion job task

File: `src/server/payload/jobs/pdf-to-exercises-task.ts`

Imports:

- Remove `parseVerifierResponseText` from helper imports.

Call site:

- When calling `processSegmentWithMultimodal`, stop passing:
  - `verifierPrompt: input.promptSnapshot.verifier`

In `processSegmentWithMultimodal`:

- Remove `verifierPrompt` from the context type.
- Remove `verifierPrompt` from destructuring.
- Add an info log near the top:

```ts
console.info(
  '[PDF→Exercises] Verifier step disabled; exercises pass through after schema validation only',
)
```

- Delete the entire verifier loop and retry logic:
  - Delete the block that builds `verifierPromptWithContext`, calls verifier, retries, pushes `PASS2_VERIFY`, and skips.
  - Delete the `callVerifier` helper function.

Return behavior:

- After enriching block IDs, return `enrichedExercises` directly.

Clean up comments:

- Remove references to "verifier pattern" in comments.
- Do not remove schema validation skip logic; it remains the only gate.

**Mandatory observability** (non-breaking):

- Add `output.verifierDisabled = true` to the job output object initialization.
- **If `output` has a TypeScript type**, update the type definition to include `verifierDisabled?: boolean` to avoid build errors.
- At job completion (before final return), add info log:
  ```ts
  console.info(
    `[PDF→Exercises] Job complete: extracted=${totalExtracted}, schemaSkipped=${schemaSkipped}, persisted=${persistedCount}, verifierDisabled=true`,
  )
  ```
- Ensure these counters are already tracked or derive them from existing variables (e.g., `enrichedExercises.length`).

### Layer 4: API Routes

#### Step 7 - Remove verifier prompts from the "for-conversion" prompts API

File: `src/app/api/prompts/for-conversion/route.ts`

- Delete the query that fetches `usage = verifier` prompts.
- Remove `verifiers` from the JSON response payload.

Response should include at least:

```json
{ "extractors": [...] }
```

#### Step 8 - Remove verifier prompt requirements from the queue API

File: `src/app/api/exercises/convert/queue/route.ts`

Request body:

- Stop destructuring `verifierPromptId` from the validated body.
- **Add deprecation warning**: After Zod validation, if `body.verifierPromptId` is present, emit:
  ```ts
  if (body.verifierPromptId) {
    console.warn(
      '[Queue API] verifierPromptId is deprecated and ignored. Remove from client. Will be rejected after next release.',
    )
  }
  ```
- Update comment that currently says verifierPromptId is required.

Prompt fetching/validation:

- Delete verifier prompt `findByID` block.
- Remove verifier `validatePromptForUsageAndTenant(..., 'verifier', ...)` call.
- Remove verifier prompt size check. **IMPORTANT**: Ensure extractor size check remains intact (do NOT remove it).
- Remove verifier hash computation.

Job input snapshot:

- Remove verifier fields from `promptRefs`, `promptSnapshot`, `promptSnapshotHash`.

Backward compat note: Zod schema accepts legacy `verifierPromptId`, but it is ignored by this route.

### Layer 5: Admin UI

#### Step 9 - Remove verifier selector from PdfConversion ConversionForm

File: `src/ui/admin/PdfConversion/ConversionForm/index.tsx`

- Remove `verifierPromptId` state and all reads/writes
- Remove `verifiers` array from prompts state and API response mapping
- Update validation: only require lessonId, mediaId, extractorPromptId
- Remove `verifierPromptId` from request body to `/api/exercises/convert/queue`
- Update empty-state condition and message to reference extractor only
- Delete the entire verifier `<select>` block

Do not change diagramPromptId logic (optional) in this plan.

#### Step 10 - Remove verifier selector from exercise-conversion ConvertForm

File: `src/ui/admin/exercise-conversion/ConvertForm/index.tsx`

- Remove verifier prompt list state and selected verifier state
- Stop reading `data.verifiers` from `/api/prompts/for-conversion`
- Remove `verifierPromptId` from queue request body
- Delete verifier `<select>`
- Update submit button disabled conditions to only require extractor selection

### Layer 6: i18n

#### Step 11 - Remove now-unused i18n keys

Files:

- `src/i18n/en.json`
- `src/i18n/he.json`

In both files, under the `exerciseConversion` namespace, remove:

- `verifierPrompt`
- `selectVerifier`

Keep all other keys unchanged.

### Layer 7: Config Docs + Typegen

#### Step 12 - Update system params JSDoc

File: `src/infra/config/system-params.ts`

Change the JSDoc line:

- From: "Maximum allowed size for extractor/verifier prompts in bytes"
- To: "Maximum allowed size for extractor prompts in bytes"

#### Step 13 - Regenerate Payload types (mandatory)

Run:

```bash
pnpm generate:types
```

Verify generated `src/payload-types.ts` no longer includes `verifier` in the `Prompts.usage` union type.

#### Step 14 - Regenerate admin import map (recommended safety)

Run:

```bash
pnpm generate:importmap
```

### Layer 8: Tests

#### Step 15 - Update helper unit tests (remove verifier cases)

File: `tests/unit/server/services/exercise-conversion/helpers.test.ts`

- Delete the test "should pass for valid verifier prompt"
- Replace the "wrong usage" test to assert mismatch against `expectedUsage = 'extractor'` using a prompt with `usage = 'chat'`

#### Step 16 - Update job schema unit tests

File: `tests/unit/api/schemas/job-schemas.spec.ts`

- In the "should accept valid conversion request" test, remove `verifierPromptId` from the input.
- Add a new test asserting backward compat: schema accepts requests that include `verifierPromptId`.

#### Step 17 - Update jobs integration test

File: `tests/int/jobs-run-now.int.spec.ts`

- Stop creating a verifier prompt.
- Remove all verifier fields from the queued job input.
- Remove verifier prompt cleanup call.
- In the lock contention test, remove verifier fields from the dummy job input.

#### Step 18 - Update conversion API integration test

File: `tests/int/exercise-conversion-api.int.spec.ts`

- Stop creating verifier prompts.
- Update expectations: `data.verifiers` should be undefined (or remove the assertion).
- Remove `verifierPromptId` from queue request bodies.
- Remove verifier prompt cleanup calls.

### Layer 9: Quality Gates + Smoke

#### Step 19 - Run quality gates

Run in order, stop on first failure:

```bash
pnpm tsc --noEmit
pnpm format:check
pnpm lint
pnpm test
```

#### Step 20 - Manual smoke (recommended)

- Admin UI: PDF conversion page shows only extractor selector (no verifier selector).
- API: `/api/prompts/for-conversion` returns only `extractors`.
- API: `/api/exercises/convert/queue` succeeds without `verifierPromptId`.
- Queue a real job via admin UI and verify job output includes `verifierDisabled: true` and counter logs in job runner output.
- Prompts collection: existing `usage = verifier` docs may display as legacy; this is accepted.
- **Optional**: In Prompts collection admin, open a legacy verifier prompt and edit a non-usage field (e.g., title). Verify save succeeds without UI errors or auto-clearing the usage field.

### Layer 10: Final Repo-Wide Verification (do not skip)

#### Step 21 - Search for leftover verifier artifacts

Run these repo-wide searches and ensure there are no unexpected hits in `src/` or `tests/`.
Use ripgrep (`rg`) to avoid shell-specific `grep` differences on Windows.

```bash
rg -n "verifierPromptId" src tests
rg -n "usage:\s*'verifier'" src tests
rg -n "PASS2_VERIFY" src tests
rg -n "VERIFICATION_FAILED" src tests
rg -n "parseVerifierResponseText" src tests
rg -n "callVerifier" src tests
rg -n "selectVerifier" src tests
rg -n "verifierPrompt" src tests
rg -n "validatePromptForUsageAndTenant" src tests  # Ensure no stray 'verifier' callers remain
rg -n "verifierDisabled" src tests  # Should only appear in job task output and this plan
```

Allowed exceptions:

- `src/server/payload/jobs/types.ts` (deprecated optional legacy fields)
- `src/server/api/schemas/job-schemas.ts` (deprecated optional legacy field)
- `.tasks/` (planning docs)

#### Step 22 - Verify generated types are clean

```bash
rg -n "'verifier'" src/payload-types.ts
```

Must return zero hits.

## Rollback Strategy

If this change causes production issues:

1. **Immediate**: Revert the PR (code rollback via git revert + redeploy).
2. Because legacy verifier prompt documents were never deleted from the DB, reverting restores the old behavior immediately.
3. **In-flight jobs fix** (choose one):
   - **Default (recommended)**: Patch the reverted code to make verifier fields optional in job input types (same as Step 1 of this plan) so in-flight jobs without verifier snapshot can complete.
   - **Alternative**: If reverted code requires verifier fields, manually re-queue all jobs created during the no-verifier window using the old admin UI.
4. **Post-rollback audit**: Run `rg -n "verifierPromptId" src/server/payload/jobs` to confirm optional fields are present in reverted code.
5. Investigate root cause before attempting removal again.

## PR Description (copy/paste template)

```md
## What Changed

- Removed verifier prompt selection from admin PDF conversion UI (both forms)
- Removed verifier prompt fetching from `/api/prompts/for-conversion`
- Removed verifier prompt validation/snapshotting from `/api/exercises/convert/queue`
- Removed verifier LLM call, retry, and skip logic from the `pdf_to_exercises` job task
- Removed `verifier` from allowed `Prompts.usage` options
- Removed `parseVerifierResponseText` and `callVerifier`
- Narrowed `validatePromptForUsageAndTenant` to `extractor` only
- Removed verifier i18n keys (en + he)
- Added deprecation warning log when legacy `verifierPromptId` is posted to queue API
- Added mandatory observability: `output.verifierDisabled=true` + counter logs in job task

## Backward Compatibility

- `verifierPromptId` is optional in the queue request schema (old cached clients accepted, field ignored)
- Job input types keep verifier fields as optional (in-flight jobs won't crash)
- Legacy verifier prompt documents remain in DB (no migration)

## Operator Notes

- Existing verifier prompt documents remain in the database but are no longer supported, selectable, or creatable
- Admins may manually delete them via the Prompts collection
- Exercises are no longer semantically verified against source PDF; only schema validation remains

## Deprecation Timeline

- Legacy verifier fields (`verifierPromptId`, `promptSnapshot.verifier`, `promptSnapshotHash.verifier`) will be hard-deleted next release
```

## Follow-ups (create tickets)

1. Next release cleanup (mandatory)

- Hard-delete legacy verifier fields from `src/server/payload/jobs/types.ts`
- Remove `verifierPromptId` from `src/server/api/schemas/job-schemas.ts` (stop accepting it)
- Optionally return a 400 error if `verifierPromptId` is posted after deprecation window

3. Monitoring (recommended)

- Track extracted vs schema-skipped counts per job for post-deploy quality correlation.

4. Legacy Prompts cleanup (recommended)

- Decide on migration strategy for `usage='verifier'` documents in Prompts collection:
  - Option A: Migrate to `usage='legacy_verifier'` + add admin filter to hide
  - Option B: Data migration to delete entirely
  - Option C: Accept they remain visible but unsupported in admin (current state)
