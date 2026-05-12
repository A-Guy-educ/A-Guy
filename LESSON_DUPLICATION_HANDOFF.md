# Lesson Duplication — Handoff Notes

For the next Claude (or human) touching the lesson-duplication pipeline.
Last updated by the agent that merged `fix/lesson-duplication-pipeline-issues`.

---

## TL;DR

The duplication feature works end-to-end. AI variations get produced, validated
structurally + semantically, written to a new draft lesson, and surfaced in a
review screen for the admin to polish. There's one significant architectural
debt and a handful of known operational sharp edges. Read this before changing
anything in `src/server/services/lesson-duplication/` or
`src/infra/llm/services/lesson-duplication-variation-service.ts`.

---

## Highest-priority pending work

### 1. Genkit schema-constrained output (deferred)

**Today:** prompts ask Gemini to return JSON. The variation service parses
free-form text and runs it through a post-generation sanitizer (`sanitizeAiBlocks`)
that strips known-bad fields (e.g. `answer.kind` on non-geometry/axis question
blocks). When AI invents a NEW unknown field shape, `payload.create` rejects
it and the orchestrator's per-exercise isolation records `GENERATION_FAILED`.

**The right fix:** pass a Zod schema to Genkit's `ai.generate({ output: { schema } })`.
Gemini's JSON-mode then refuses to emit non-conforming output. We already have
`ContentSchema` defined at
[src/server/payload/collections/Exercises/schemas.ts:604](src/server/payload/collections/Exercises/schemas.ts).

**Why I didn't do it:**

- `UnifiedLLMProvider.generateChatCompletion` (in [src/infra/llm/providers/factory.ts](src/infra/llm/providers/factory.ts))
  only returns `{ text, raw }`. Need a new method or an optional `outputSchema`
  field on the input.
- Zod → JSON-schema translation for a 12-branch discriminated union is non-trivial.
  Gemini's JSON-mode is picky about complex schemas. `ContentSchema` uses
  `.strict()` on every block, which Gemini's responseSchema may reject — likely
  needs a relaxed version with `.passthrough()`, or a hand-written schema subset
  scoped to what the variation pipeline actually needs.
- Existing unit-test fixtures use simplified blocks that wouldn't pass strict
  validation. They'd need updates.

**Steps when picking this up:**

1. Read the variation service ([src/infra/llm/services/lesson-duplication-variation-service.ts](src/infra/llm/services/lesson-duplication-variation-service.ts))
   — note the two passes (`creativePrompt`/`derivationPrompt`) and the existing
   retry envelope (JSON, rate-limit, circuit-breaker backoffs).
2. Decide: extend `UnifiedLLMProvider` with a new method, or call
   `getGenkitInstance` directly in the variation service. The latter is more
   surgical for a feature that doesn't share much with other LLM callers.
3. Build a `LessonVariationOutputSchema` derived from `ContentSchema` but with
   `.passthrough()` instead of `.strict()` (Gemini fights strict schemas).
4. For pass 2, build a small schema for the derivation-pass response —
   `{ solution, fullSolution, answer?: { correctOptionIds?: string[] } }`.
5. Keep the existing `sanitizeAiBlocks` as a safety net.
6. Add a test that mocks Genkit to verify the schema flows through.

When it ships, you can delete `sanitizeAiBlocks` (or at least the `answer.kind`
strip rule) and let the schema be the single enforcement point.

---

## Other deferred work, ordered by impact

### 2. Background job execution on Vercel

Each duplication run is serial (`CONCURRENCY_LIMIT = 1`) and worst-case wall
time per exercise is ~10 min (180s timeout × 2 passes + rate-limit + breaker
backoffs). For lessons with >5 exercises this exceeds Vercel function timeout
(60s Hobby / 300s Pro). When the function is killed, the LessonDuplications
record stays in `running` with partial progress; admins re-trigger from the
jobs UI.

**Fix path:** external queue worker (Inngest, Trigger.dev, or a self-hosted
Node worker that polls `payload-jobs`). The job handler at
[src/server/payload/jobs/lesson-duplication-task.ts](src/server/payload/jobs/lesson-duplication-task.ts)
is already idempotent on `duplicationId`, so an external runner just needs to
call `runDuplicationOrchestrator` and pick up where the killed function left off.

### 3. Transactional safety

`/api/lessons/[id]/duplicate-variation/route.ts` and the endpoint helpers
(`deepCloneLesson`, `createOutputLesson`, `createOutputExercise`) do not share
a Payload transaction. On partial failures we can end up with an orphan output
lesson + zero exercises. Catch handlers cover the LessonDuplications record's
status but not the orphan side effects.

**Fix:** use `payload.db.beginTransaction()` and thread `transactionID` through
the request. Touches 4–6 files; not trivial but mechanical.

### 4. Semantic reviewer model independence

The semantic validator currently uses `LESSON_DUPLICATION_VARIATION_DETERMINISTIC`
(same model family as the generator). A different family (Claude / OpenAI)
would catch more subtle issues — comment block in
[src/server/services/lesson-duplication/validators/semantic.ts](src/server/services/lesson-duplication/validators/semantic.ts)
marks this as the right place to swap if review quality becomes a problem.

### 5. The `kind` answer hallucination is a symptom of broader prompt drift

Today's prompts (`src/infra/llm/prompts/lesson-duplication/*.md`) describe
preserving block structure in English. Gemini still occasionally adds fields
that aren't in our schema. Future hallucination patterns will appear; either:

- Add new strip rules to `sanitizeAiBlocks` (whack-a-mole), or
- Ship the schema-constrained output (item #1, which is the durable fix).

---

## Known operational sharp edges (read before debugging)

### Endpoint path collision with Payload's built-in duplicate

**DO NOT** rename `POST /api/lessons/:id/duplicate-variation` back to `/duplicate`.
Payload's collection-config registers its own built-in duplicate at
`/api/<collection>/:id/duplicate` and shadows custom endpoints at the same
path. The built-in is also disabled via `disableDuplicate: true` on the Lessons
collection — keep both safeguards.

If you're investigating "modal works but creates a dumb 44-exercise clone",
the user is hitting the built-in route. Check the modal's `fetch()` URL is
`/duplicate-variation` and that `disableDuplicate: true` is present in
[src/server/payload/collections/Lessons.ts](src/server/payload/collections/Lessons.ts).

### Prompt loading

`loadSubjectPrompt` (in the variation service) reads from `process.cwd()`-relative
paths. Works in both Next.js bundles (via `outputFileTracingIncludes` in
[next.config.js](next.config.js)) and standalone scripts.

If you ever try the static-import pattern (`import x from '../prompts/foo.md'`)
again, also update:

1. The webpack `asset/source` rule in `next.config.js` (already present).
2. The raw-markdown Vite plugin in `vitest.config.unit.mts` (already present).
3. The tsx scripts under `scripts/` — tsx can't process `.md` imports, will need
   a fallback path.

### Rate limiting + circuit breaker

The Genkit adapter wraps every call in a 60s circuit breaker (see
[src/infra/llm/providers/shared/circuit-breaker.ts](src/infra/llm/providers/shared/circuit-breaker.ts)).
When Gemini rate-limits one call, the breaker opens for ~60s. Subsequent
exercises bounce off it immediately. The variation service's
`getCircuitBreakerCooldownMs` parses the breaker's `Try again in Xs` message
and waits accordingly.

If you raise `CONCURRENCY_LIMIT` above 1:

- The compile-time `_AssertConcurrencyOne` guard fails. Replace `appendEntry`
  with an atomic `$push` MongoDB update before deleting the assert.
- Expect to hit rate limits more often. Tune backoff schedule in
  `RATE_LIMIT_BACKOFFS_MS`.

### Model name pitfalls

`gemini-3.1-pro` returns **404 on the public Gemini API** but the error
adapter mis-classifies the 404 as `RATE_LIMIT_ERROR`. Retries don't help — the
model just doesn't exist there. If you see endless rate-limit retries, check
[src/infra/llm/models.ts](src/infra/llm/models.ts) for the actual model name
being used. Known-good models on this account: `gemini-2.5-pro`, `gemini-2.5-flash`.

### Slug "Power - Copy" with spaces

If you see lesson slugs with spaces:

- Likely Payload's built-in Duplicate ran. Confirm `disableDuplicate: true`.
- The `formatSlug` chain has a defensive `.replace(/\s+/g, '-')` and the
  Lessons `beforeChange` hook re-sanitizes any non-`[a-z0-9-]` slug. Both
  should catch this.

---

## How to test locally

There are two scripts under `scripts/`:

```bash
# Lists recent lessons + their exercise counts
node --env-file=.env --import tsx scripts/list-lessons.ts

# Runs the full orchestrator against real Mongo + real Gemini
node --env-file=.env --import tsx scripts/test-duplication-live.ts <lessonId> [level] [subject]
# defaults: level=deep, subject=calculus
```

The live test calls `runDuplicationOrchestrator` directly. **It does NOT go
through the queue/runner.** Useful for testing the AI pipeline; not useful
for testing the endpoint or job wiring.

For end-to-end with HTTP + queue: `pnpm dev`, then `curl` the
`/api/lessons/<id>/duplicate-variation` endpoint with a valid session cookie.

---

## Architecture map

```
POST /api/lessons/[id]/duplicate-variation/route.ts
     └─> Next.js wrapper, forwards to:
          duplicateLessonEndpoint  (src/server/payload/endpoints/lessons/duplicate.ts)
               ├─> level=none → deepCloneLesson (inline, synchronous)
               └─> level=light|medium|deep:
                    ├─> create LessonDuplications record (status=pending)
                    ├─> payload.jobs.queue('lesson_duplication')
                    └─> fire-and-forget POST /api/jobs/run-immediate
                                          └─> lessonDuplicationTask.handler
                                               └─> runDuplicationOrchestrator (orchestrator.ts)
                                                    ├─> selectExercisesScaled (cap at 20)
                                                    ├─> createOutputLesson (new draft)
                                                    └─> for each exercise (CONCURRENCY=1):
                                                         ├─> RouterStrategy.apply
                                                         │     ├─> light + algebraic → ScriptVariationStrategy
                                                         │     └─> else → AiVariationStrategy.generateVariation
                                                         │          ├─> pass 1 (creative, temp 0.7)
                                                         │          ├─> pass 2 (deterministic, temp 0)
                                                         │          ├─> mergePassOutputs
                                                         │          └─> sanitizeAiBlocks
                                                         ├─> validateExerciseStructural
                                                         │     ├─> blocking → drop, appendFailure
                                                         │     └─> warning  → fillMissingFieldsWithPlaceholders, appendWarning
                                                         ├─> validateExerciseSemantic (skipped on script / none / warning-only)
                                                         └─> createOutputExercise (per-exercise isolated try/catch)
                                                    └─> final status: succeeded / needs_review / failed

Admin review:  /admin/lesson-duplications/<id>  (LessonDuplicationReview component)
              └─> GET /api/lesson-duplications/[id]/record  (with embedded exercise pairs)
              └─> POST /api/lesson-duplications/[id]/resolve (skip / regenerate / keep / looks_right)
```

---

## Files most touched by this PR (where the bugs lived)

- [src/server/services/lesson-duplication/orchestrator.ts](src/server/services/lesson-duplication/orchestrator.ts) — main pipeline
- [src/infra/llm/services/lesson-duplication-variation-service.ts](src/infra/llm/services/lesson-duplication-variation-service.ts) — two-pass AI gen
- [src/server/services/lesson-duplication/validators/structural.ts](src/server/services/lesson-duplication/validators/structural.ts) — blocking vs warning split
- [src/server/services/lesson-duplication/validators/semantic.ts](src/server/services/lesson-duplication/validators/semantic.ts) — LLM-based reviewer
- [src/server/payload/endpoints/lessons/duplicate.ts](src/server/payload/endpoints/lessons/duplicate.ts) — endpoint + deep-clone
- [src/server/payload/collections/LessonDuplications.ts](src/server/payload/collections/LessonDuplications.ts) — job-record schema
- [src/ui/admin/LessonDuplicationReview/index.tsx](src/ui/admin/LessonDuplicationReview/index.tsx) — review screen UI
- [src/app/api/jobs/run-immediate/route.ts](src/app/api/jobs/run-immediate/route.ts) — knows about `lesson_duplication` task

---

## If something breaks: triage order

1. **No new lesson appears after clicking Duplicate.**
   - Check `/admin/collections/lesson-duplications` — is there a `pending` record?
   - If yes: job runner didn't fire. Check `/api/jobs/run-immediate` is reachable
     and `resolvePublicOrigin` resolved correctly (logs).
   - If no record at all: endpoint didn't create one. Check auth / network tab.

2. **Record stuck in `running` forever.**
   - Vercel function hit timeout. Check Vercel function logs for the runner.
   - Manually re-trigger from the jobs UI or rerun via the live-test script.

3. **`outputLesson` exists but has zero exercises.**
   - Every per-exercise `createOutputExercise` failed schema validation.
   - Check `failures[]` on the record for `GENERATION_FAILED` entries with the
     specific schema error.
   - If the error mentions `[blocks.X.answer.kind]` — Gemini hallucinated `kind`
     on a non-geometry/axis block. `sanitizeAiBlocks` should strip this; if a
     NEW hallucination shape, add a case there.

4. **Duplication completed but all exercises have `_TODO:_` placeholders.**
   - That's by design — Gemini omitted hint/solution/fullSolution on every
     question block. The admin polishes from the review screen.
   - Prompts may need tightening if this happens consistently. See `src/infra/llm/prompts/lesson-duplication/<subject>-<level>-agent-prompt.md`.

5. **Tests fail in CI but pass locally.**
   - The integration tests under `tests/int/lesson-duplication-*` use a local
     Docker Mongo (started by `global-int-setup`). CI runs them serial with a
     fresh container each time. Atlas latency is not a factor in CI.

---

Good luck. The pipeline is in a usable but not yet bulletproof state. Schema-constrained
output (#1 above) is the next investment that'll pay off proportional to the time
you put in.
