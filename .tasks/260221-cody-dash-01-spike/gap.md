# Gap Analysis: 260221-cody-dash-01-spike

## Summary

- Gaps Found: 9
- Spec Revised: Yes

## Gaps Identified

### Gap 1: CopilotKit v1.50+ adapter API may have fundamentally changed

**Severity:** Critical
**Location:** R2 — CopilotKit runtime API route
**Issue:** The spec referenced `GoogleGenerativeAIAdapter` and `OpenAIAdapter` as class-based imports from `@copilotkit/runtime`. However, CopilotKit v1.50+ (the version that will be installed) may have restructured to a `CopilotRuntime({ model: "provider/model" })` string-based API. The referenced issue #3217 is not just a Gemini regression — it may indicate that the `BuiltInAgent` in v1.50+ wraps all adapters and reads `serviceAdapter.provider`/`serviceAdapter.model` properties that don't exist on legacy adapters, causing `"google/undefined"` or `"undefined/undefined"` errors. The old adapter classes may have been removed or bypassed entirely.
**Fix Applied:** Rewrote R2 with a 4-step adapter strategy that tries both class-based and model-string APIs, with clear fallback ordering. Added a note about pinning to v1.49.x as a last resort.

### Gap 2: Missing CSS loading strategy for (cody) layout

**Severity:** High
**Location:** R3 — (cody) route group layout
**Issue:** The spec said "bare layout with Tailwind CSS" but never specified HOW Tailwind CSS would be loaded. The `(cody)` layout is a separate root layout with its own `<html>/<body>` — it cannot inherit CSS from the `(frontend)` layout. The project has a strict `check-no-css` husky hook that blocks committing any new `.css` files (only `src/app/(frontend)/globals.css` is excepted). Options: (a) import the existing `(frontend)/globals.css`, (b) create a new CSS file and update the hook exception. Option (a) is appropriate for a spike.
**Fix Applied:** Added explicit instructions to import `'../(frontend)/globals.css'` for Tailwind and `'@copilotkit/react-ui/styles.css'` for CopilotKit component styles. Added guardrail explaining the no-CSS hook.

### Gap 3: Missing CopilotKit component CSS import

**Severity:** High
**Location:** R3 — (cody) route group layout
**Issue:** `<CopilotChat>` from `@copilotkit/react-ui` requires its own CSS (`styles.css`) to render properly. Without it, the chat widget renders as unstyled HTML. The spec never mentioned importing CopilotKit's CSS. Analysis confirmed that importing from node_modules does NOT trigger the check-no-css hook (which only inspects committed file paths, not import statements).
**Fix Applied:** Added `import '@copilotkit/react-ui/styles.css'` instruction to R3.

### Gap 4: Missing server-init import pattern

**Severity:** Medium
**Location:** R2 — API route
**Issue:** All complex API routes in the project (e.g., `src/app/api/agent/chat/route.ts`, `src/app/api/agent/chat/stream/route.ts`) begin with `import '@/infra/config/server-init'` as the first import. This initializes lazy-loading for runtime config values. The spec's route had no mention of this project-standard import pattern.
**Fix Applied:** Added `import '@/infra/config/server-init'` as a required first import in R2.

### Gap 5: Missing structured logging and error handling

**Severity:** Medium
**Location:** R2 — API route
**Issue:** The spec said "Export POST handler" but didn't specify logging or error handling. Every complex API route in the project uses the project logger (`@/infra/utils/logger/logger`) with `requestId` correlation, and wraps handlers in try/catch with a consistent error response pattern (structured JSON with requestId, dev-only stack traces). The CopilotKit route handles LLM streaming — exactly the kind of route that benefits from structured logging for debugging adapter failures.
**Fix Applied:** Added logger import, requestId generation, and full error handling pattern to R2.

### Gap 6: Ambiguous API key choice for OpenAI fallback

**Severity:** Medium
**Location:** R2 — API route, env vars
**Issue:** The project has two distinct OpenAI key variables: `OPENAI_API_KEY` (used by embeddings/direct OpenAI SDK) and `OPENAI_COMPATIBLE_API_KEY` (used by the LLM factory for proxy/compatible providers). The factory at `src/infra/llm/providers/factory.ts` explicitly says "ONLY uses OPENAI_COMPATIBLE_API_KEY - no fallback to OPENAI_API_KEY". CopilotKit's `OpenAIAdapter` uses the native OpenAI SDK directly, so `OPENAI_API_KEY` is actually the correct choice, but this was not explained and would confuse future developers who know the factory's convention.
**Fix Applied:** Added explicit documentation that `OPENAI_API_KEY` is correct for CopilotKit (not the factory pattern), with a requirement to add a code comment explaining the choice. Added env validation requirement.

### Gap 7: Missing env validation before adapter construction

**Severity:** Medium
**Location:** R2 — API route
**Issue:** The spec didn't mention what happens if neither `GEMINI_API_KEY` nor `OPENAI_API_KEY` is set. The project pattern (from `src/infra/llm/embeddings.ts`) is to check and throw early with descriptive errors. Without validation, CopilotKit's internals would throw a confusing internal error.
**Fix Applied:** Added env validation requirement to R2 — check for at least one API key and return 500 with descriptive error if missing.

### Gap 8: Incorrect `@copilotkit/runtime-client-gql` package reference

**Severity:** Low
**Location:** R1 — Install packages
**Issue:** The spec said "If using Gemini adapter: also add `@copilotkit/runtime-client-gql` if needed." This package is a transitive dependency of `@copilotkit/react-core` (already included in the install). It's the GraphQL client for CopilotKit's runtime communication and has nothing to do with Gemini. Separately installing it is unnecessary and misleading.
**Fix Applied:** Removed the `runtime-client-gql` instruction. Added note that it's a transitive dep.

### Gap 9: Potential Zod 3/4 version conflict

**Severity:** Medium
**Location:** R1 — Install packages, runtime behavior
**Issue:** The project uses `zod@^4.3.5` (Zod 4). CopilotKit's runtime hard-depends on `zod@^3.23.3`. Zod 4 is a major version with breaking changes. While pnpm should isolate them via nested node_modules, issues could surface if CopilotKit passes Zod schemas across the boundary to user code, or if TypeScript sees two different Zod types.
**Fix Applied:** Added post-install verification step to R1, Zod conflict guardrail, and documentation requirement in R6 spike-result.md.

## Changes Made to Spec

### Requirements Updated:
- **R1**: Removed `@copilotkit/runtime-client-gql`, added Zod 3/4 conflict verification step
- **R2**: Complete rewrite — added server-init import, logger, requestId, 4-step adapter strategy (class-based → model-string → fallback), API key documentation, env validation, error handling pattern
- **R3**: Added Tailwind CSS loading strategy (`import '../(frontend)/globals.css'`), CopilotKit CSS loading (`import '@copilotkit/react-ui/styles.css'`), explanation of check-no-css hook safety
- **R6**: Added documentation requirements for adapter API approach, Zod conflicts, React 19 compat

### New Sections Added:
- **Guardrails**: No new CSS files, API key separation, Zod boundary, middleware interaction, next.config.js expectations
- **Acceptance Criteria**: Added `pnpm install` verification and spike-result adapter API documentation

### Notes Updated:
- Added reference to `src/app/api/agent/chat/route.ts` for API route patterns
- Added React 19 compatibility confirmation
- Expanded CopilotKit v1.50+ warning to explain the deeper BuiltInAgent architecture change
- Added pinning to v1.49.x as documented last resort
