# Plan: CopilotKit + LLM Spike

**Task ID**: 260221-cody-dash-01-spike
**Task Type**: implement_feature
**Estimated Steps**: 5 steps (~15 min each)

## Assumptions

1. CopilotKit latest version (installed via `pnpm add`) may be v1.50+ which may have changed adapter APIs. The build agent must try class-based adapters first, then fall back to model-string API, then fall back to OpenAI, and document which approach worked.
2. The project uses Zod 4 (`^4.3.5`) while CopilotKit depends on Zod 3. pnpm should isolate them, but if TypeScript errors arise at the Zod type boundary, the build agent should document this and consider `pnpm.overrides` if needed.
3. No rerun-feedback or plan-review rejection exists — this is the initial plan.
4. The `(cody)` route group will be served at `/cody` — the i18n middleware matcher (`/((?!api|admin|_next|_static|.*\\..*).*)'`) will run on it but only sets a locale header/cookie, which is harmless.
5. The spike-result.md output path references `.tasks/260221-cody-operations-dashboard/` which does not exist yet — the build agent should create it.

---

## Step 1: Install CopilotKit packages and verify dependencies

**Time**: ~10 min
**Spec refs**: R1

**Files to Touch**:
- `package.json` (MODIFIED — new deps added by pnpm)
- `pnpm-lock.yaml` (MODIFIED — auto-updated)

**Exact Behavior**:
1. Run: `pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime`
2. Do NOT separately install `@copilotkit/runtime-client-gql` — it is a transitive dep of `@copilotkit/react-core`.
3. After install, run `pnpm ls zod` to check if Zod 3 and Zod 4 coexist cleanly (pnpm should nest Zod 3 under CopilotKit's node_modules).
4. Run `pnpm tsc --noEmit` to verify no type conflicts introduced.
5. If critical peer dependency conflicts arise (especially React version mismatches), document them and try pinning CopilotKit to `@copilotkit/*@1.49.x` as a fallback.

**Tests (FAIL before, PASS after)**:
1. **Dependency resolution test** (manual verification):
   - `pnpm ls @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime` succeeds and shows installed versions
   - `pnpm tsc --noEmit` passes without new errors
2. **Import smoke test** — create a unit test:
   - File: `tests/unit/copilotkit-import.test.ts`
   - Test: dynamically import `@copilotkit/runtime` and verify the `CopilotRuntime` export exists
   - Why it fails before: packages not installed
   - Why it passes after: packages installed

```typescript
// tests/unit/copilotkit-import.test.ts
import { describe, it, expect } from 'vitest'

describe('CopilotKit packages', () => {
  it('should export CopilotRuntime from @copilotkit/runtime', async () => {
    const mod = await import('@copilotkit/runtime')
    expect(mod.CopilotRuntime).toBeDefined()
  })

  it('should export CopilotKit from @copilotkit/react-core', async () => {
    const mod = await import('@copilotkit/react-core')
    expect(mod.CopilotKit).toBeDefined()
  })
})
```

**Acceptance Criteria**:
- [ ] `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime` appear in package.json dependencies
- [ ] `pnpm install` completes without critical peer dep errors
- [ ] `pnpm tsc --noEmit` passes
- [ ] Unit test for imports passes: `pnpm test:unit -- tests/unit/copilotkit-import.test.ts`

---

## Step 2: Create CopilotKit runtime API route

**Time**: ~15 min
**Spec refs**: R2

**Files to Touch**:
- `src/app/api/copilotkit/route.ts` (NEW)

**Exact Behavior**:
Create a POST handler at `/api/copilotkit` that:

1. **First import**: `import '@/infra/config/server-init'` (matches project pattern from `src/app/api/agent/chat/route.ts`)
2. **Imports**: `logger` from `@/infra/utils/logger/logger`, `NextResponse` from `next/server`, CopilotKit runtime classes
3. **requestId**: Generate `crypto.randomUUID()` per request for log correlation
4. **Env validation**: Check that at least one of `GEMINI_API_KEY` or `OPENAI_API_KEY` is set. If neither, return 500 with `{ error: 'No LLM API key configured...', requestId }`.
5. **Adapter strategy** (try in order):
   - Try `GoogleGenerativeAIAdapter` with `GEMINI_API_KEY` (if the class exists in the installed version)
   - If adapter classes don't exist in v1.50+, try `CopilotRuntime({ model: "google/gemini-pro" })` string-based API
   - If Gemini fails (issue #3217), switch to `OpenAIAdapter` with `OPENAI_API_KEY`
   - If adapter classes don't exist, try `CopilotRuntime({ model: "openai/gpt-4o" })` string-based API
6. **API key comment**: Add a code comment explaining why we use `OPENAI_API_KEY` (direct OpenAI SDK) not `OPENAI_COMPATIBLE_API_KEY` (LLM factory pattern)
7. **CopilotRuntime**: Create instance and call `runtime.handleRequest({ serviceAdapter, ... })` or the string-based equivalent
8. **Error handling**: Wrap in try/catch with the project pattern (logger.error, structured JSON response with requestId, dev-only stack)
9. **Export**: `export async function POST(request: Request) { ... }`

**Input/Output**:
- **Input**: POST request from CopilotKit frontend client (GraphQL-over-HTTP body)
- **Output**: Streaming response (SSE or CopilotKit's native streaming format)
- **Error**: `{ error: string, requestId: string, stack?: string }` with status 500

**Tests (FAIL before, PASS after)**:
1. **Unit test for env validation logic**:
   - File: `tests/unit/copilotkit-route.test.ts`
   - Test: When neither `GEMINI_API_KEY` nor `OPENAI_API_KEY` is set, the route returns 500 with descriptive error
   - Why it fails before: route file doesn't exist
   - Why it passes after: route has env validation

```typescript
// tests/unit/copilotkit-route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('CopilotKit API route', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return 500 when no API keys configured', async () => {
    // Mock server-init to no-op
    vi.mock('@/infra/config/server-init', () => ({}))
    vi.mock('@/infra/utils/logger/logger', () => ({
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
    }))

    const { POST } = await import('@/app/api/copilotkit/route')
    const request = new Request('http://localhost/api/copilotkit', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toMatch(/API key/i)
    expect(body.requestId).toBeDefined()
  })
})
```

**Acceptance Criteria**:
- [ ] `src/app/api/copilotkit/route.ts` exists with POST export
- [ ] First import is `'@/infra/config/server-init'`
- [ ] Logger with requestId is used for all log lines
- [ ] Env validation returns 500 when no keys configured
- [ ] Error handler follows project pattern (structured JSON, dev-only stack)
- [ ] Comment explains `OPENAI_API_KEY` vs `OPENAI_COMPATIBLE_API_KEY` choice
- [ ] `pnpm tsc --noEmit` passes
- [ ] Unit test passes: `pnpm test:unit -- tests/unit/copilotkit-route.test.ts`

---

## Step 3: Create (cody) route group layout

**Time**: ~10 min
**Spec refs**: R3

**Files to Touch**:
- `src/app/(cody)/layout.tsx` (NEW)

**Exact Behavior**:
Create a minimal root layout for the `(cody)` route group:

1. This is a **Server Component** (no `'use client'` directive).
2. **HTML structure**: `<html lang="en"><body>{children}</body></html>`
3. **Tailwind CSS**: `import '../(frontend)/globals.css'` — reuses existing Tailwind + design tokens. This does NOT create a new CSS file (husky hook safe).
4. **CopilotKit CSS**: `import '@copilotkit/react-ui/styles.css'` — imports from node_modules (husky hook safe — hook only blocks committed `.css` files in the repo, not import statements in `.tsx` files).
5. **Metadata**: Basic title "Cody" and description.
6. **No auth, no i18n, no providers** — this is a spike. Keep it minimal.
7. **suppressHydrationWarning** on `<html>` (Next.js best practice).

**GUARDRAIL**: Do NOT create any `.css` or `.scss` files. The `check-no-css` husky hook (`/.husky/check-no-css`) will block commits of any CSS file except `src/app/(frontend)/globals.css`.

**Tests (FAIL before, PASS after)**:
1. **File existence + structure test**:
   - File: `tests/unit/cody-layout.test.tsx`
   - Test: Import the layout module and verify it exports a default function. Render it with React Testing Library and verify it produces `<html>` and `<body>` elements.
   - Why it fails before: file doesn't exist
   - Why it passes after: layout module is created

```typescript
// tests/unit/cody-layout.test.tsx
import { describe, it, expect } from 'vitest'

describe('Cody layout', () => {
  it('should export a default layout function', async () => {
    const mod = await import('@/app/(cody)/layout')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})
```

**Acceptance Criteria**:
- [ ] `src/app/(cody)/layout.tsx` exists
- [ ] Imports `'../(frontend)/globals.css'` for Tailwind
- [ ] Imports `'@copilotkit/react-ui/styles.css'` for CopilotKit styles
- [ ] Contains `<html>` and `<body>` tags
- [ ] No new `.css` or `.scss` files created
- [ ] `pnpm tsc --noEmit` passes
- [ ] Unit test passes: `pnpm test:unit -- tests/unit/cody-layout.test.tsx`

---

## Step 4: Create Cody page with CopilotKit provider and test action

**Time**: ~15 min
**Spec refs**: R3, R4, R5

**Files to Touch**:
- `src/app/(cody)/cody/page.tsx` (NEW)

**Exact Behavior**:
Create a client component page at `/cody`:

1. **`'use client'`** directive at the top — CopilotKit hooks require client component.
2. **CopilotKit provider**: `<CopilotKit runtimeUrl="/api/copilotkit">` wrapping the page content.
3. **CopilotChat**: `<CopilotChat />` from `@copilotkit/react-ui` — renders the full chat UI (not just a sidebar or popup).
4. **Test action**: `useCopilotAction({ name: 'getCurrentTime', description: 'Get the current date and time', handler: async () => new Date().toISOString() })` — wired inside the page component.
5. **Minimal UI**: A heading "Cody Dashboard (Spike)" and the chat component below it. Use Tailwind classes for basic layout (`flex flex-col h-screen`).
6. **No auth** — spike only.

**Input/Output**:
- User visits `/cody` → sees chat widget
- User types "what time is it?" → LLM calls `getCurrentTime` action → displays ISO timestamp
- Responses stream token-by-token (verified visually in R5, and the route's streaming nature)

**Tests (FAIL before, PASS after)**:
1. **Component structure test**:
   - File: `tests/unit/cody-page.test.tsx`
   - Test: Import the page module, verify it's a client component (has `'use client'` directive — check file content), verify it exports a default function
   - Why it fails before: file doesn't exist
   - Why it passes after: page component created

```typescript
// tests/unit/cody-page.test.tsx
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Cody page', () => {
  it('should be a client component', () => {
    const filePath = resolve(__dirname, '../../src/app/(cody)/cody/page.tsx')
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/['"]use client['"]/)
  })

  it('should export a default page function', async () => {
    // Note: This may fail in pure unit test env due to CopilotKit deps
    // At minimum verify the file can be parsed
    const filePath = resolve(__dirname, '../../src/app/(cody)/cody/page.tsx')
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('export default')
    expect(content).toContain('CopilotKit')
    expect(content).toContain('CopilotChat')
    expect(content).toContain('getCurrentTime')
    expect(content).toContain('useCopilotAction')
  })
})
```

2. **Integration test** — verify the page renders at `/cody` (E2E-style, may be verified manually):
   - This is an E2E concern (R5) but can be partially checked with a basic dev server test or visual verification. The build agent should verify `pnpm build` succeeds with the new route and document streaming behavior in spike-result.md.

**Acceptance Criteria**:
- [ ] `src/app/(cody)/cody/page.tsx` exists with `'use client'` directive
- [ ] Uses `<CopilotKit runtimeUrl="/api/copilotkit">` provider
- [ ] Uses `<CopilotChat />` for chat UI
- [ ] `useCopilotAction` registered with name `'getCurrentTime'`
- [ ] `pnpm tsc --noEmit` passes
- [ ] Unit test passes: `pnpm test:unit -- tests/unit/cody-page.test.tsx`

---

## Step 5: Document spike result

**Time**: ~10 min
**Spec refs**: R6

**Files to Touch**:
- `.tasks/260221-cody-operations-dashboard/spike-result.md` (NEW — directory must be created)

**Exact Behavior**:
Create the spike result document with these sections:

1. **Summary**: Which adapter worked (Gemini class-based, Gemini model-string, OpenAI class-based, OpenAI model-string, or pinned v1.49.x)
2. **Adapter API Approach**: Document whether class-based adapters (`GoogleGenerativeAIAdapter`/`OpenAIAdapter`) exist in the installed version, or if the v1.50+ model-string API was needed
3. **Package Versions**: Exact versions of all `@copilotkit/*` packages installed (from `pnpm ls`)
4. **Zod 3/4 Observations**: Whether the Zod version conflict caused any issues. Document `pnpm ls zod` output.
5. **React 19 Compatibility**: Confirm CopilotKit peer deps accept React 19 (expected: `"react": "^18 || ^19"`)
6. **Streaming Verified**: Whether token-by-token streaming worked
7. **Issues Encountered**: Any problems, workarounds, or pinned versions
8. **Next Steps**: Recommendations for TASK-02+

**Tests (FAIL before, PASS after)**:
1. **File existence test**:
   - File: `tests/unit/spike-result.test.ts`
   - Test: Verify `.tasks/260221-cody-operations-dashboard/spike-result.md` exists and contains required sections
   - Why it fails before: file doesn't exist
   - Why it passes after: spike-result.md created with all sections

```typescript
// tests/unit/spike-result.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

describe('Spike result documentation', () => {
  const filePath = resolve(__dirname, '../../.tasks/260221-cody-operations-dashboard/spike-result.md')

  it('should exist', () => {
    expect(existsSync(filePath)).toBe(true)
  })

  it('should contain required sections', () => {
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('## Summary')
    expect(content).toContain('## Adapter API Approach')
    expect(content).toContain('## Package Versions')
    expect(content).toContain('## Zod')
    expect(content).toContain('## React 19')
    expect(content).toContain('## Streaming')
    expect(content).toContain('## Issues')
  })
})
```

**Acceptance Criteria**:
- [ ] `.tasks/260221-cody-operations-dashboard/spike-result.md` exists
- [ ] Documents which adapter was used (Gemini/OpenAI)
- [ ] Documents adapter API approach (class-based vs model-string)
- [ ] Documents package versions
- [ ] Documents Zod 3/4 conflict status
- [ ] Documents React 19 compatibility
- [ ] Documents streaming verification
- [ ] Unit test passes: `pnpm test:unit -- tests/unit/spike-result.test.ts`

---

## Final Verification

After all steps complete, run:

```bash
# Type check
pnpm tsc --noEmit

# All unit tests for this spike
pnpm test:unit -- tests/unit/copilotkit-import.test.ts tests/unit/copilotkit-route.test.ts tests/unit/cody-layout.test.tsx tests/unit/cody-page.test.tsx tests/unit/spike-result.test.ts

# Lint
pnpm lint

# Verify no CSS files committed
git diff --cached --name-only | grep -E '\.(css|scss)$' || echo "No CSS files - OK"
```

## Files Summary

| File | Action | Step |
|------|--------|------|
| `package.json` | MODIFIED | 1 |
| `pnpm-lock.yaml` | MODIFIED | 1 |
| `tests/unit/copilotkit-import.test.ts` | NEW | 1 |
| `src/app/api/copilotkit/route.ts` | NEW | 2 |
| `tests/unit/copilotkit-route.test.ts` | NEW | 2 |
| `src/app/(cody)/layout.tsx` | NEW | 3 |
| `tests/unit/cody-layout.test.tsx` | NEW | 3 |
| `src/app/(cody)/cody/page.tsx` | NEW | 4 |
| `tests/unit/cody-page.test.tsx` | NEW | 4 |
| `.tasks/260221-cody-operations-dashboard/spike-result.md` | NEW | 5 |
| `tests/unit/spike-result.test.ts` | NEW | 5 |

## Build Agent Guidance

### Adapter Strategy Decision Tree

The CopilotKit adapter landscape is unstable (v1.50+ broke Gemini). Follow this exact order:

1. **Install packages** → check `pnpm ls @copilotkit/runtime` for version
2. **If v1.49.x or below**: Use `GoogleGenerativeAIAdapter` class with `GEMINI_API_KEY`
3. **If v1.50+**: 
   - Check if `GoogleGenerativeAIAdapter` still exists as an export: `import { GoogleGenerativeAIAdapter } from '@copilotkit/runtime'`
   - If it exists → try it. If you get "google/undefined" errors → switch to OpenAI
   - If it doesn't exist → try model-string API: `new CopilotRuntime({ model: { provider: 'google', model: 'gemini-pro' } })`
   - If Gemini still fails → use `OpenAIAdapter` or model-string `{ provider: 'openai', model: 'gpt-4o' }` with `OPENAI_API_KEY`
4. **If ALL adapters fail**: Pin to `@copilotkit/*@1.49.x`, reinstall, and retry
5. **Document everything** in spike-result.md

### CSS Safety

- NEVER create `.css` or `.scss` files — the husky hook will block commits
- Only import existing CSS: `'../(frontend)/globals.css'` and `'@copilotkit/react-ui/styles.css'`
- Importing from node_modules is safe — the hook only inspects `git diff --cached --name-only`

### Test Execution

Run each step's tests individually to verify:
```bash
pnpm test:unit -- tests/unit/copilotkit-import.test.ts    # Step 1
pnpm test:unit -- tests/unit/copilotkit-route.test.ts     # Step 2
pnpm test:unit -- tests/unit/cody-layout.test.tsx          # Step 3
pnpm test:unit -- tests/unit/cody-page.test.tsx            # Step 4
pnpm test:unit -- tests/unit/spike-result.test.ts          # Step 5
```
