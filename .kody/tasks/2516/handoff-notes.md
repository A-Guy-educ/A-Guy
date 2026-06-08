# Task 2516: src/server/services/ — thin in-code documentation

## What was done in this session

Created `src/server/services/index.ts` — a folder-level JSDoc header covering:
- What this folder is (server-side business logic layer)
- Entry points for each major flow (chat, guest, AI, access control, PDF, study plans)
- Load-bearing gotchas (overrideAccess requirement, guest session state machine, in-memory rate limits, entitlement fallback chain, context resolution priority)

## What was already done (prior session)

The prior session on this branch had already added `@ai-summary` to all 12 top-level service files and to subdirectory files (exercise-conversion/*, lesson-context-conversion/*, study-plan/*, tts/*). The issue description ("0/12 modules carrying @ai-summary") was out of date.

## Pre-existing issue

`src/payload-types.ts` is flagged as stale by `check-types-drift.ts` — a `payload-mcp-api-keys` collection (MCP plugin) is in the live schema but not in the committed types. This is unrelated to doc changes; fix with `pnpm generate:types` if needed.
