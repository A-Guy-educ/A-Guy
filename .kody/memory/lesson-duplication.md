---
title: Lesson Duplication Service
type: architecture
updated: 2026-05-10
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1517
  - https://github.com/A-Guy-educ/A-Guy/pull/1467
  - https://github.com/A-Guy-educ/A-Guy/pull/1540
---

The lesson duplication service generates variations of exercises for practice. It uses a strategy pattern with three variation levels.

## Variation Levels

| Level | Purpose | Strategy |
|-------|---------|----------|
| Light | Pure algebraic re-expression (e.g., swap x→y) | algebraic-detector → script-strategy |
| Medium | Semantic rewrite via LLM | llm-variation-service |
| Deep | Full agentic rewrite with reasoning | llm-variation-service (deep model) |

## Architecture

- **Router**: strategies/router.ts — detects exercise type and routes to appropriate strategy
- **Orchestrator**: orchestrator.ts — coordinates concurrent duplication, max 3 parallel workers
- **Validators**: validators/semantic.ts (LLM-based), validators/structural.ts (schema-based)
- **Variation Service**: infra/llm/services/lesson-duplication-variation-service.ts — LLM prompts for medium/deep

## Key Decisions

- Algebraic-only exercises skip LLM calls and use lightweight script transformations
- Retry logic: one retry on JSON/structure errors before throwing VariationGenerationError
- Prompt fallbacks: inline defaults if prompt files fail to load (serverless safety)

## Validation

- Structural validation: schema compliance, required fields presence
- Semantic validation: LLM-assisted check for meaning preservation, returns reasons[] on failure
- Suggestion actions: MISSING_QUESTION → regenerate

## Related

- [design-system](./design-system.md) — UI patterns for lesson views
- [conventions](./conventions.md) — TypeScript patterns used
