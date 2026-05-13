---
title: Lesson Duplication Service
type: architecture
updated: 2026-05-13
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
  - https://github.com/A-Guy-educ/A-Guy/pull/1565
---

The lesson duplication service generates variations of exercises for practice. It uses a strategy pattern with three variation levels and supports subject-specific prompts. Failed exercises surface in an admin review screen for manual resolution.

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

## Model Configuration (#1554)

Variation levels use specific thinking budgets for deterministic vs creative passes:

| Key | Thinking Budget | Use Case |
|-----|----------------|----------|
| LESSON_DUPLICATION_VARIATION_CREATIVE | 4000 tokens | Light/medium variations |
| LESSON_DUPLICATION_VARIATION_DETERMINISTIC | 6000 tokens | Deep variations |

## Prompt Examples (#1557)

Light-level prompts include 3 numeric examples demonstrating what "light variation" means. Examples use concrete Input/Output pairs so the LLM understands the transformation scope. A regression test validates that light prompts have distinct I/O blocks.

## Serverless Bundle Requirements (#1565)

Routes that invoke the lesson-duplication variation service need prompt files shipped in their function bundle. The following routes include `./src/infra/llm/prompts/**/*` in their `outputFileTracingIncludes`:

- `/api/agent/chat`
- `/api/lessons/:id/duplicate-variation`
- `/api/jobs/run-immediate`
- `/api/lesson-duplications/:id/resolve`

## Script Strategy Numeric Substitution (#1565)

When generating light variations, the script-strategy swaps numbers using a ±30% factor. To ensure the replacement always differs from the original, it tries up to 8 candidate factors and picks the first that rounds to a different value. If all candidates round back (edge case for small integers), it falls back to `originalValue ± 1`.

## Architecture

- **Router**: strategies/router.ts — detects exercise type and routes to appropriate strategy
- **Algebraic Detector**: strategies/algebraic-detector.ts — checks if an exercise is purely algebraic (symbol manipulation only, no real-world context). Pure algebraic exercises skip LLM calls entirely.
- **Subject Detector**: subject-detector.ts — auto-detects lesson subject from exercise block types
- **Orchestrator**: orchestrator.ts — coordinates concurrent duplication; pre-creates output lesson; tracks source→output exercise mappings; max 3 parallel workers
- **Validators**: validators/semantic.ts (LLM-based), validators/structural.ts (schema-based)
- **Variation Service**: infra/llm/services/lesson-duplication-variation-service.ts — loads per-subject prompts, handles retry and two-pass fallback

## Orchestrator Output Tracking

When the orchestrator runs, it:
1. Creates a draft output lesson (title: <source> - Variation (<level>))
2. Processes exercises concurrently, creating output exercise records
3. Stores outputExercises[] mapping { sourceExerciseId, outputExerciseId, strategy } on the LessonDuplications record

## Key Decisions

- Algebraic-only exercises skip LLM calls via the algebraic-detector; script-strategy handles them
- Retry logic: one retry on JSON/structure errors before throwing VariationGenerationError
- Prompt fallbacks: inline defaults if prompt files fail to load (serverless safety)
- Two-pass variation: medium level tries LLM first; if it fails structurally, falls back to light/script
- Subject auto-detection helps users select the correct prompt template
- Serverless routes must declare prompt file dependencies via outputFileTracingIncludes

## Validation

- Structural validation: schema compliance, required fields presence
- Semantic validation: LLM-assisted check for meaning preservation, returns reasons[] on failure
- Suggestion actions: MISSING_QUESTION → regenerate
- Failures array on LessonDuplications has a resolved boolean — set true after admin resolution

## Admin Review Screen

When the orchestrator finishes with failures, the record enters needs_review status. Admins use the review screen (/admin/lesson-duplications/:id) to inspect and resolve failures. See admin/lesson-duplication-review.md.

## Related

- admin/lesson-duplication-review.md — Admin review screen pattern
- design-system.md — UI patterns for lesson views
- conventions.md — TypeScript patterns used
