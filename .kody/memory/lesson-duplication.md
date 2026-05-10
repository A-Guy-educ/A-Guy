---
title: Lesson Duplication Service
type: architecture
updated: 2026-05-10
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1517
  - https://github.com/A-Guy-educ/A-Guy/pull/1467
  - https://github.com/A-Guy-educ/A-Guy/pull/1540
  - https://github.com/A-Guy-educ/A-Guy/pull/1546
  - https://github.com/A-Guy-educ/A-Guy/pull/1548
---

The lesson duplication service generates variations of exercises for practice. It uses a strategy pattern with three variation levels and supports subject-specific prompts. Failed exercises surface in an admin review screen for manual resolution.

## Variation Levels

| Level | Purpose | Strategy |
|-------|---------|----------|
| Light | Pure algebraic re-expression (e.g., swap x→y) | algebraic-detector → script-strategy |
| Medium | Semantic rewrite via LLM; two-pass: falls back to light if LLM fails | llm-variation-service |
| Deep | Full agentic rewrite with reasoning | llm-variation-service (deep model) |

## Subject Selection

Users choose a subject when initiating duplication. Valid subjects: `mixed`, `algebra`, `geometry`, `calculus`, `other`. Each subject has its own set of LLM prompts (`prompts/lesson-duplication/<subject>-<level>-agent-prompt.md`). Using the wrong subject prompt leads to poor-quality variations.

## Architecture

- **Router**: `strategies/router.ts` — detects exercise type and routes to appropriate strategy
- **Algebraic Detector**: `strategies/algebraic-detector.ts` — checks if an exercise is purely algebraic (symbol manipulation only, no real-world context). Pure algebraic exercises skip LLM calls entirely.
- **Orchestrator**: `orchestrator.ts` — coordinates concurrent duplication; pre-creates output lesson; tracks source→output exercise mappings; max 3 parallel workers
- **Validators**: `validators/semantic.ts` (LLM-based), `validators/structural.ts` (schema-based)
- **Variation Service**: `infra/llm/services/lesson-duplication-variation-service.ts` — loads per-subject prompts, handles retry and two-pass fallback

## Orchestrator Output Tracking

When the orchestrator runs, it:
1. Creates a draft output lesson (title: `<source> - Variation (<level>)`)
2. Processes exercises concurrently, creating output exercise records
3. Stores `outputExercises[]` mapping `{ sourceExerciseId, outputExerciseId, strategy }` on the `LessonDuplications` record

## Key Decisions

- Algebraic-only exercises skip LLM calls via the algebraic-detector; script-strategy handles them
- Retry logic: one retry on JSON/structure errors before throwing VariationGenerationError
- Prompt fallbacks: inline defaults if prompt files fail to load (serverless safety)
- Two-pass variation: medium level tries LLM first; if it fails structurally, falls back to light/script

## Validation

- Structural validation: schema compliance, required fields presence
- Semantic validation: LLM-assisted check for meaning preservation, returns reasons[] on failure
- Suggestion actions: MISSING_QUESTION → regenerate
- Failures array on `LessonDuplications` has a `resolved` boolean — set true after admin resolution

## Admin Review Screen

When the orchestrator finishes with failures, the record enters `needs_review` status. Admins use the review screen (`/admin/lesson-duplications/:id`) to inspect and resolve failures. See [admin/lesson-duplication-review](./admin/lesson-duplication-review.md).

## Related

- [admin/lesson-duplication-review](./admin/lesson-duplication-review.md) — Admin review screen pattern
- [design-system](./design-system.md) — UI patterns for lesson views
- [conventions](./conventions.md) — TypeScript patterns used
