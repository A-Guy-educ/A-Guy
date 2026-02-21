# TASK-01: CopilotKit + LLM Spike

## Summary
Validate that CopilotKit runtime works with Gemini (primary) or OpenAI (fallback) in our Next.js 15 + React 19 stack. This is a time-boxed spike (2 hours max) — if Gemini adapter fails, switch to OpenAI immediately.

## Task Type
implement_feature

## Requirements

### R1: Install CopilotKit packages
- `pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime`
- Do NOT separately install `@copilotkit/runtime-client-gql` — it is a transitive dependency of `@copilotkit/react-core`
- After install, verify no critical pnpm peer dependency conflicts (especially Zod 3 vs project's Zod 4)

### R2: Create CopilotKit runtime API route
- File: `src/app/api/copilotkit/route.ts`
- **First import**: `import '@/infra/config/server-init'` (matches project pattern from `src/app/api/agent/chat/route.ts`)
- Import project logger: `import { logger } from '@/infra/utils/logger/logger'`
- Generate a `requestId` per request for log correlation
- **Adapter strategy** (try in order):
  1. Try `GoogleGenerativeAIAdapter` with `GEMINI_API_KEY` (if adapter class exists in installed version)
  2. If adapter classes don't exist (v1.50+ removed them), try the new `CopilotRuntime({ model: "google/gemini-pro" })` string-based API
  3. If Gemini fails (issue #3217 — "google/undefined" errors), switch to `OpenAIAdapter` with `OPENAI_API_KEY`
  4. If adapter classes don't exist, try `CopilotRuntime({ model: "openai/gpt-4o" })`
- **API key choice**: Use `OPENAI_API_KEY` (not `OPENAI_COMPATIBLE_API_KEY`) for the OpenAI fallback — CopilotKit's adapter uses the native OpenAI SDK directly, not our LLM factory's compatible-provider pattern. Add a code comment explaining this.
- **Env validation**: Before constructing any adapter, validate that at least one of `GEMINI_API_KEY` or `OPENAI_API_KEY` is set. Return 500 with descriptive error if neither is available.
- **Error handling**: Wrap handler in try/catch following project pattern:
  ```typescript
  catch (error) {
    logger.error({ err: error, requestId }, 'CopilotKit route error')
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId,
      ...(process.env.NODE_ENV === 'development' && error instanceof Error
        ? { stack: error.stack } : {}),
    }, { status: 500 })
  }
  ```
- Export POST handler

### R3: Create minimal (cody) route group
- File: `src/app/(cody)/layout.tsx` — bare layout with `<html>`, `<body>`, Tailwind CSS
  - **Tailwind loading**: Import the existing frontend globals.css — `import '../(frontend)/globals.css'` — this brings in Tailwind + design tokens. Acceptable for a spike; a dedicated minimal CSS entrypoint can be created in a future task (requires updating `.husky/check-no-css` exception list).
  - **CopilotKit CSS**: Import CopilotKit styles — `import '@copilotkit/react-ui/styles.css'` — this imports from node_modules and does NOT trigger the check-no-css husky hook (which only blocks committed .css files, not import statements in .tsx files).
- File: `src/app/(cody)/cody/page.tsx` — client component with `<CopilotKit>` provider + `<CopilotChat>`
- No auth for spike (auth added in TASK-07)

### R4: Wire one test action
- In the page component: `useCopilotAction({ name: 'getCurrentTime', handler: async () => new Date().toISOString() })`
- Verify chat can call the action and display the result

### R5: Verify streaming
- Send a message in the chat
- Verify the response streams token-by-token (not all-at-once)

### R6: Document result
- Write spike result to `.tasks/260221-cody-operations-dashboard/spike-result.md`
- Document: which adapter worked (Gemini/OpenAI), any issues encountered, package versions
- Document: whether adapter classes exist or if v1.50+ model-string API was needed
- Document: any Zod 3/4 conflict observations
- Document: React 19 compatibility confirmed (peer deps support ^19)

## Files to Create/Modify
- `src/app/api/copilotkit/route.ts` (NEW)
- `src/app/(cody)/layout.tsx` (NEW)
- `src/app/(cody)/cody/page.tsx` (NEW)
- `.tasks/260221-cody-operations-dashboard/spike-result.md` (NEW)
- `package.json` (MODIFIED — new deps)

## Acceptance Criteria
- [ ] `/cody` page loads without errors
- [ ] Chat widget appears and accepts text input
- [ ] Sending "what time is it?" triggers the getCurrentTime action
- [ ] Response streams (not blocked)
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm install` completes without critical peer dep errors
- [ ] spike-result.md documents which adapter was used
- [ ] spike-result.md documents adapter API approach (class-based vs model-string)

## Guardrails
- **No new CSS files**: Do NOT create any `.css` or `.scss` files — the check-no-css husky hook will block commits. Import existing `globals.css` from `(frontend)` and CopilotKit CSS from node_modules.
- **API key separation**: Use `OPENAI_API_KEY` for CopilotKit (direct OpenAI SDK), NOT `OPENAI_COMPATIBLE_API_KEY` (which is for the project's LLM factory/proxy pattern).
- **Zod boundary**: CopilotKit depends on Zod 3; this project uses Zod 4. If TypeScript errors appear at the Zod type boundary, document in spike-result.md and consider `pnpm.overrides` or isolating CopilotKit's Zod usage.
- **Middleware interaction**: The i18n middleware (`middleware.ts`) will run on `/cody` routes (sets locale cookie/header). This is harmless for the spike. Future tasks may add `/cody` to the middleware exclude list.
- **No next.config.js changes expected**: CopilotKit runtime is pure JS with no native deps. If bundling issues occur, add `@copilotkit/runtime` to `serverExternalPackages` as a fix and document in spike-result.md.

## Notes
- CopilotKit v1.50+ has a known Gemini adapter regression (issue #3217). The issue may be deeper than just Gemini — the `BuiltInAgent` in v1.50+ may bypass adapter classes entirely. If all adapter classes fail, consider pinning to `@copilotkit/*@1.49.x` as a last resort and document the decision.
- The `(cody)` layout needs its own `<html>/<body>` tags — there's no shared root layout in this project (only route-group layouts).
- Reference: `src/app/(frontend)/layout.tsx` for layout pattern (but much simpler — no i18n, no locale).
- Reference: `src/app/api/agent/chat/route.ts` for API route pattern (server-init import, logger, requestId, error handling).
- React 19 compatibility confirmed: CopilotKit peer deps support `"react": "^18 || ^19"`.
