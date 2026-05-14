---
title: Lesson Duplication Service
type: architecture
updated: 2026-05-14
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1517
  - https://github.com/A-Guy-educ/A-Guy/pull/1467
  - https://github.com/A-Guy-educ/A-Guy/pull/1540
  - https://github.com/A-Guy-educ/A-Guy/pull/1546
  - https://github.com/A-Guy-educ/A-Guy/pull/1548
  - https://github.com/A-Guy-educ/A-Guy/pull/1554
  - https://github.com/A-Guy-educ/A-Guy/pull/1556
  - https://github.com/A-Guy-educ/A-Guy/pull/1557
  - https://github.com/A-Guy-educ/A-Guy/pull/1560
  - https://github.com/A-Guy-educ/A-Guy/pull/1602
  - https://github.com/A-Guy-educ/A-Guy/pull/1604
---

The lesson duplication service generates variations of exercises for practice. It uses a strategy pattern with three variation levels and supports subject-specific prompts. Failed exercises surface in an admin review screen for manual resolution.

## Trigger Path: Cron Worker (#1602)

As of PR #1602, the duplication pipeline is driven by a **Vercel cron worker** at `/api/cron/process-duplications` (runs every minute via `vercel.json`). The old Payload job-queue + run-immediate HTTP ping approach was removed.

- The cron endpoint atomically claims one `pending`/`running` LessonDuplications record via `findOneAndUpdate` with an expiry-based lock — a crashed tick can't permanently jam the queue
- The orchestrator is **resumable**: each completed exercise is immediately streamed to the record's `outputExercises[]` array; if a function times out mid-run, the next cron tick picks up where it left off
- Wall-clock budget is enforced: `maxDuration = 800 s` on the cron endpoint, with 30 s finalization headroom
- Auth: `Authorization: Bearer <CRON_SECRET>` header validated via `timingSafeEqual`; local dev allows missing secret in non-production

The endpoint's only job is to create a `pending` record; the cron does the rest. No fire-and-forget HTTP, no Payload job-queue indirection.

## Orchestrator Resumability (#1602)

`runDuplicationOrchestrator` now returns a typed `RunOutcome` (`succeeded | needs_review | in_progress | failed`) and accepts a `deadlineMs` option:

- First tick (status `pending`): creates the output lesson, flips to `running`
- Resuming tick (status `running`): skips already-processed exercises identified by `outputExercises[]`, `failures[]`, and orphan exercises already in the output lesson (identified by `Variation of <sourceId>` title pattern)
- Exercises are processed **sequentially** (not concurrently) because `appendEntry`'s read-modify-write on `warnings[]`/`failures[]` is not safe under parallel writes
- Orchestrator skips terminal records (`succeeded`, `needs_review`, `failed`) without error

## Source Exercise Resolution (#1602)

`getSourceExercisesForLesson` (in `source-exercises.ts`) resolves exercises for duplication:

- **Preferred path**: reads `lesson.blocks[].exercise` (the authoritative content path matching the renderer) and batch-fetches each referenced exercise
- **Fallback**: FK reverse query `exercises.where: { lesson: equals }` for legacy lessons not yet migrated to the blocks model
- Previously, only the FK path was used, silently producing empty variations for lessons that reference exercises owned by a different lesson

## LLM Output Schema Constraints (#1602)

LLM output is constrained via Genkit's structured-output mode (Gemini `responseSchema`):

- **Pass 1 (creative variation)**: uses a per-exercise JSON Schema derived at runtime from the input exercise's `content.blocks` shape via `deriveJsonSchemaFromValue` — forces Gemini to keep the same block layout without hallucinating extra/missing fields
- **Pass 2 (solution derivation)**: uses `SolutionDerivationOutputSchema` (Zod) — a small, well-bounded envelope `{solution, fullSolution, answer}`; this is the strongest gate against prose/markdown output
- `LessonVariationOutputSchema` (Zod) is kept as documentation; it is **not wired up** for pass 1 because Gemini collapses complex nested schemas to `{ "content": "blocks" }` literals regardless of `.strict()` vs `.passthrough()`
- The adapter's `output` field (Genkit's parsed structured value) is preferred over `text` parsing — Gemini's responseSchema can return structured payload parts that `result.text` doesn't faithfully serialize
- Text fallback exists for the rare case the provider returns free text (e.g., schema rejection)

Model pinned to **gemini-3.1-pro-preview** (not gemini-2.5-pro): 2.5-pro silently mangles complex schemas and times out on calculus/axis derivations even with small schemas. Per-exercise timeout raised to **300 s** (was 180 s) to accommodate 3.x with complex prompts.

## Safety Guards for Scripts (#1602)

`scripts/list-lessons.ts` and `scripts/test-duplication-live.ts` refuse to run against non-local Mongo unless `ALLOW_LIVE=1` is set:

```typescript
function assertSafeEnvironment(): void {
  if (process.env.ALLOW_LIVE === '1') return
  const uri = process.env.DATABASE_URI ?? process.env.MONGODB_URI ?? ''
  const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('mongo:')
  if (!isLocal) {
    console.error('[script] Refusing to run against non-local Mongo. Set ALLOW_LIVE=1 to override.')
    process.exit(1)
  }
}
```

## Variation Levels

| Level | Purpose | Strategy |
|-------|---------|----------|
| Light | Pure algebraic re-expression (e.g., swap x→y) | algebraic-detector → script-strategy |
| Medium | Semantic rewrite via LLM; two-pass: falls back to light if LLM fails | llm-variation-service |
| Deep | Full agentic rewrite with reasoning | llm-variation-service (deep model) |

## Subject Selection

Users can choose a subject when initiating duplication, or the system auto-detects it. Valid subjects: mixed, algebra, geometry, calculus, other. Each subject has its own set of LLM prompts (prompts/lesson-duplication/<subject>-<level>-agent-prompt.md). Using the wrong subject prompt leads to poor-quality variations.

### Subject Auto-Detection (#1560)

When duplicating, the LessonDuplicateButton modal calls GET /api/lessons/:id/suggested-subject (admin-only) to auto-detect the subject based on exercise block types:

- question_geometry block → geometry
- question_axis or question_multi_axis block → calculus
- Both present → mixed
- Neither → algebra (default)

Detection is implemented in detectLessonSubject(exercises) — a pure function in src/server/services/lesson-duplication/subject-detector.ts that walks each exercise's content.blocks[].

## Architecture

- **Cron Worker**: `src/app/api/cron/process-duplications/route.ts` — polls every minute, claims one record, delegates to orchestrator
- **Orchestrator**: `orchestrator.ts` — resumable sequential processing, streams output to record
- **Source Exercises**: `source-exercises.ts` — resolves exercises from lesson.blocks, not just FK
- **Router**: strategies/router.ts — detects exercise type and routes to appropriate strategy
- **Algebraic Detector**: strategies/algebraic-detector.ts — checks if an exercise is purely algebraic
- **Variation Service**: `infra/llm/services/lesson-duplication-variation-service.ts` — handles two-pass LLM calls with schema-constrained output
- **Output Schemas**: `infra/llm/schemas/lesson-duplication-output.ts` — Zod schemas + JSON schema builder for pass 1 and pass 2
- **Validators**: validators/semantic.ts (LLM-based), validators/structural.ts (schema-based)

## Key Decisions

- Cron worker is the sole trigger; no Payload job queue, no run-immediate HTTP ping
- Exercise source of truth is `lesson.blocks[]` (authoritative for renderer), with FK fallback
- LLM output constrained via per-exercise JSON Schema (pass 1) and Zod (pass 2); model pinned to gemini-3.1-pro-preview
- Scripts require `ALLOW_LIVE=1` to run against non-local Mongo — prevents accidental prod calls
- Sequential exercise processing (not concurrent) to keep appendEntry read-modify-write safe

## Admin Review Screen

When the orchestrator finishes with failures, the record enters `needs_review` status. Admins use the review screen (`/admin/lesson-duplications/:id`) to inspect and resolve failures.

## Related

- [conventions](./conventions.md) — `ALLOW_LIVE` safety guard pattern, `packageManager` convention
- [architecture](./architecture.md) — CSP note for vercel.live on /admin
- design-system.md — UI patterns for lesson views
