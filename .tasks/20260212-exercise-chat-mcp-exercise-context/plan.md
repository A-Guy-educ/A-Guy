# Plan: 20260212-exercise-chat-mcp-exercise-context

## Architecture Summary

**Current state**: Student chat uses `chatWithExerciseHelper()` / `streamChatWithExerciseHelper()` — no tool-calling. `exerciseId` is sent in every request but only used for context-key resolution and lesson-context lookup. The model never sees exercise content.

**Target state**: Student chat gets MCP tool-calling with a single restricted tool (`getActiveExerciseContext`) that fetches and returns sanitized exercise content. Works in both non-streaming and streaming endpoints. Frontend also tracks and sends `activeBlockId`.

**Key design decisions**:

- **Shared helper (Approach A)**: Extract student tool-calling logic into a shared module used by both `handleContextScopedChat` (non-streaming) and `agentChatStream` (streaming)
- **Streaming tool-calling**: Add `generateStreamingChatCompletionWithTools` to the `UnifiedLLMProvider` interface; Genkit's `ai.generateStream()` natively supports `tools`/`toolChoice`/`maxTurns` — tool execution happens server-side, SSE protocol unchanged
- Single custom MCP tool registered via `@payloadcms/plugin-mcp` custom tools API
- Server-side guards: tool arg validation (exerciseId must match request), output sanitization (strip answer keys), student-only tool allowlist
- `activeBlockId` tracked via last-interaction in `ExerciseRenderer`, communicated via props

---

## Step 1: Create Exercise Content Sanitizer Utility

**~20 min | Spec: NFR-001, FR-002, FR-004**

**WHY**: Before any exercise data reaches the model, correctness fields must be stripped. This is a pure function — easy to test in isolation. Canonical types at `src/shared/exercise-content/types.ts`.

**Files to touch**:
| File | Status |
|------|--------|
| `src/shared/exercise-content/sanitize.ts` | NEW |
| `tests/unit/shared/exercise-content-sanitize.test.ts` | NEW |

**Exact behavior**:

- Export `sanitizeExerciseContentForStudent(content: ContentData): ContentData`
- Deep-clone input (no mutation)
- Per block type, strip these fields:

| Block Type                     | Fields to STRIP                                                           |
| ------------------------------ | ------------------------------------------------------------------------- |
| `question_select` (true_false) | `answer.correctOptionId`, `hint`, `solution`, `fullSolution`              |
| `question_select` (mcq)        | `answer.correctOptionIds`, `hint`, `solution`, `fullSolution`             |
| `question_free_response`       | `answer.acceptedAnswers`, `hint`, `solution`, `fullSolution`              |
| `question_table`               | `table.answers`, `table.solutionFill`, `hint`, `solution`, `fullSolution` |
| `rich_text`, `latex`           | (pass through unchanged)                                                  |

- Keep student-visible: `prompt`, `options`, `multiSelect`, `table.headers`, `table.rowsData`, `table.showBorders`, `table.showHeader`, `table.columnAlignment`, all `id`/`type`/`variant`/`selectionMode`

**Tests (FAIL before, PASS after)**:

1. **strips correctness fields from all block types** — Input: ContentData with one of each question type, all correctness fields populated. Assert: output has none of the stripped fields. Assert: output preserves all student-visible fields.

2. **preserves non-question blocks unchanged** — Input: ContentData with `rich_text` and `latex` blocks. Assert: output identical to input.

**Acceptance criteria**:

- [ ] `sanitizeExerciseContentForStudent` exported
- [ ] All correctness fields stripped
- [ ] Student-visible fields preserved
- [ ] Input not mutated

**Similar pattern**: `src/server/repos/mcp/transforms/index.ts` (field-picking per collection)

---

## Step 2: Add `activeBlockId` to Chat Request Schema & API Service

**~15 min | Spec: FR-001, FR-006**

**WHY**: Server needs `activeBlockId` from the client. Extend the existing Zod schema and API service context type.

**Files to touch**:
| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/endpoints/agent/chat/request-validation.ts` | MODIFIED | ~7-21 (schema) |
| `src/server/services/api/api-service.ts` | MODIFIED | ~71-77 (context type) |

**Exact behavior**:

- Add `activeBlockId: z.string().optional()` to `chatRequestSchema`
- Add `activeBlockId?: string` to context param type in `apiService.chat()` and streaming path

**Tests (FAIL before, PASS after)**:

1. **schema accepts activeBlockId** — `chatRequestSchema.safeParse({ message: 'hi', acknowledgment: 'ack', lessonId: 'x', activeBlockId: 'block-1' })` → `success === true`, `data.activeBlockId === 'block-1'`

2. **schema accepts request without activeBlockId (backward compatible)** — same parse without `activeBlockId` → `success === true`, `data.activeBlockId === undefined`

**Acceptance criteria**:

- [ ] `activeBlockId` optional in schema
- [ ] Existing requests still validate
- [ ] API service context type updated

---

## Step 3: Register Custom MCP Tool `getActiveExerciseContext`

**~30 min | Spec: FR-003, FR-004, NFR-001, NFR-002**

**WHY**: Core MCP tool the model calls. Registered via `@payloadcms/plugin-mcp` custom tools API (`mcp.tools` config array). The handler fetches, sanitizes, and returns exercise content.

**Files to touch**:
| File | Status |
|------|--------|
| `src/server/payload/plugins/mcp/student-tools.ts` | NEW |
| `src/server/payload/plugins/mcp/index.ts` | MODIFIED (add tool to `mcp.tools` config) |
| `tests/unit/mcp/student-tools.test.ts` | NEW |

**Exact behavior**:

- Define custom tool:
  - `name: 'getActiveExerciseContext'`
  - `description: 'Fetch the exercise content currently displayed to the student. Returns exercise title, blocks (prompts, questions, options) with answer keys removed.'`
  - `parameters: { exerciseId: z.string(), activeBlockId: z.string().optional() }`
  - Handler:
    1. `req.payload.findByID({ collection: 'exercises', id: args.exerciseId, depth: 0 })`
    2. Parse `exercise.content` as `ContentData`
    3. `sanitizeExerciseContentForStudent(content)`
    4. If `activeBlockId` provided, extract that specific block into `activeQuestion` field
    5. Return `{ content: [{ type: 'text', text: JSON.stringify({ exerciseId, title, activeBlockId, blocks: sanitized.blocks, activeQuestion }) }] }`

- Add to plugin config in `index.ts`:
  ```typescript
  mcp: {
    tools: [getActiveExerciseContextTool],
    ...existingConfig
  }
  ```

**Tests (FAIL before, PASS after)**:

1. **handler returns sanitized exercise content** — Unit test handler with mock req + mock `payload.findByID` returning exercise with `correctOptionIds`. Assert: response contains `title`, `blocks`, `prompt`. Assert: response does NOT contain `correctOptionIds`, `correctOptionId`, `acceptedAnswers`.

2. **handler returns error for non-existent exercise** — Mock `findByID` throwing NotFound. Assert: handler returns error text (no crash).

**Acceptance criteria**:

- [ ] `getActiveExerciseContext` registered in MCP `tools/list`
- [ ] Handler fetches and sanitizes output
- [ ] No correctness fields in output
- [ ] Works with/without `activeBlockId`

**Similar pattern**: `src/server/payload/plugins/mcp/index.ts` (existing `overrideAuth` and plugin config)

---

## Step 4: Add Student Tool Allowlist and Arg Validation

**~20 min | Spec: FR-004, NFR-002**

**WHY**: Second defense layer in the chat endpoint's `toolExecutor`. Even if MCP exposes a tool, the chat backend validates (a) only `getActiveExerciseContext` allowed for students, (b) `args.exerciseId` matches request context.

**Files to touch**:
| File | Status |
|------|--------|
| `src/server/repos/mcp/tool-allowlist.ts` | MODIFIED (add student allowlist) |
| `src/server/repos/mcp/validation/student-tool-validator.ts` | NEW |
| `tests/unit/mcp/student-tool-validator.test.ts` | NEW |

**Exact behavior**:

- `tool-allowlist.ts`: Add `STUDENT_ALLOWED_TOOL_NAMES = new Set(['getActiveExerciseContext'])`, export `isStudentAllowedToolName()`, export `discoverStudentAllowedTools(tools: MCPTool[]): MCPTool[]`
- `student-tool-validator.ts`: Export `validateStudentToolArgs(toolName, args, requestContext: { exerciseId?: string })`:
  - If tool not in student allowlist → throw `"Tool not allowed for students"`
  - If `args.exerciseId !== requestContext.exerciseId` → throw `"exerciseId mismatch"`

**Tests (FAIL before, PASS after)**:

1. **student allowlist permits getActiveExerciseContext only** — Assert `isStudentAllowedToolName('getActiveExerciseContext') === true`. Assert `isStudentAllowedToolName('findExercises') === false`.

2. **arg validation rejects mismatched exerciseId** — `validateStudentToolArgs('getActiveExerciseContext', { exerciseId: 'other-id' }, { exerciseId: 'real-id' })` → throws containing `"exerciseId mismatch"`. Same call with matching IDs → no throw.

**Acceptance criteria**:

- [ ] Student tools restricted to `getActiveExerciseContext`
- [ ] ID mismatch throws before MCP call
- [ ] Existing admin allowlist unchanged

---

## Step 5: Update `overrideAuth` for Student Role in MCP Plugin

**~15 min | Spec: FR-003, FR-004**

**WHY**: Currently `overrideAuth` only handles admins. Non-admin authenticated users fall to API key auth (fails for browser sessions). Add student path granting ONLY custom tool access.

**Files to touch**:
| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/plugins/mcp/index.ts` | MODIFIED | ~25-45 (`overrideAuth`) |
| `tests/unit/mcp/override-auth.test.ts` | NEW |

**Exact behavior**:

- After admin check in `overrideAuth`, add:
  ```typescript
  // Authenticated non-admin: only custom tools, no collection access
  if (req.user && 'role' in req.user) {
    return {
      user: req.user,
      'payload-mcp-tool': { getActiveExerciseContext: true },
    }
  }
  ```

**Tests (FAIL before, PASS after)**:

1. **student user gets only custom tool access** — Call `overrideAuth` with student user mock. Assert: `'payload-mcp-tool'.getActiveExerciseContext === true`. Assert: no `courses`, `chapters`, `lessons`, `exercises`, `media` keys.

2. **admin user unchanged** — Call `overrideAuth` with admin user mock. Assert: full collection access (existing behavior).

**Acceptance criteria**:

- [ ] Students get custom tool only
- [ ] No collection-level find/create for students
- [ ] Admin behavior unchanged
- [ ] Unauthenticated falls through to API key auth

---

## Step 6: Add `generateStreamingChatCompletionWithTools` to Provider Interface & Genkit Adapter

**~25 min | Spec: FR-003, FR-007**

**WHY**: Streaming endpoint needs tool-calling. Genkit's `ai.generateStream()` natively supports `tools`/`toolChoice`/`maxTurns`. We add the interface method and implement it.

**Files to touch**:
| File | Status |
|------|--------|
| `src/infra/llm/providers/factory.ts` | MODIFIED (~line 139, add interface method) |
| `src/infra/llm/genkit/adapters/unified-adapter.ts` | MODIFIED (~line 148, add implementation) |

**Exact behavior**:

- Add to `UnifiedLLMProvider` interface:
  ```typescript
  generateStreamingChatCompletionWithTools?: (
    input: {
      system: string
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      model: { name: string; temperature: number; maxOutputTokens: number }
      acknowledgment: string
      tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
      toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>
      timeoutMs?: number
    },
    payload: Payload,
  ) => Promise<{ stream: AsyncIterable<{ text: string }>; response: Promise<{ text: string }> }>
  ```
- Genkit adapter implementation: mirrors existing `generateStreamingChatCompletion` but wraps tools as Genkit `tool()` objects (same as `generateChatCompletionWithTools`), then calls `ai.generateStream({ model, messages, tools, toolChoice: 'auto', maxTurns: 5 })`. Tool execution happens inside Genkit's loop — stream only emits final-turn text chunks.
- SSE protocol stays unchanged (`chunk`/`done`/`error`)

**Tests (FAIL before, PASS after)**:

1. **streaming with tools returns text chunks** — Mock Genkit `ai.generateStream` returning async iterable of chunks + a tool call. Assert: stream yields text chunks. Assert: toolExecutor was called.

2. **method is optional (backward compatible)** — Existing code that checks `if (!adapter.generateStreamingChatCompletion)` continues working.

**Acceptance criteria**:

- [ ] New method on interface (optional)
- [ ] Genkit adapter implements it
- [ ] Tools execute server-side within stream
- [ ] SSE protocol unchanged

**Similar pattern**: `unified-adapter.ts` lines 260-328 (existing non-streaming tool-calling) + lines 152-208 (existing streaming)

---

## Step 7: Extract Shared Student Tool-Calling Helper

**~25 min | Spec: FR-003, FR-004, NFR-004**

**WHY**: Both non-streaming (`handleContextScopedChat`) and streaming (`agentChatStream`) need the same logic: check if student, load MCP tools, filter to student tools, build toolExecutor with validation. Extract once, use twice.

**Files to touch**:
| File | Status |
|------|--------|
| `src/server/payload/endpoints/agent/chat/student-tools.ts` | NEW |

**Exact behavior**:
Export `prepareStudentToolCalling(params)`:

```typescript
interface StudentToolCallingParams {
  req: PayloadRequest
  userId: string | undefined
  isGuestMode: boolean
  exerciseId: string | undefined
  activeBlockId: string | undefined
  logger: typeof import('@/infra/utils/logger').logger
}

interface StudentToolCallingResult {
  enabled: boolean
  tools: MCPTool[]
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>
  systemPromptSuffix: string // exercise context hint for system prompt
}
```

Logic:

1. Return `{ enabled: false }` if: no `userId` (guest), no `exerciseId`, or MCP not available
2. Extract auth headers from `req`
3. `getMCPClient().listTools(authHeaders)` → filter via `discoverStudentAllowedTools()`
4. If no tools after filter → return `{ enabled: false }`
5. Build `toolExecutor` that:
   - Calls `validateStudentToolArgs(toolName, args, { exerciseId })`
   - Calls `mcpClient.callTool(toolName, args, authHeaders)`
   - Extracts text from result
6. Build `systemPromptSuffix`: `"The student is currently viewing exercise ID '${exerciseId}'. Active question block: '${activeBlockId || 'unknown'}'. Use the getActiveExerciseContext tool to fetch the exercise content."`
7. Return `{ enabled: true, tools, toolExecutor, systemPromptSuffix }`

**Tests (FAIL before, PASS after)**:

1. **returns enabled=true for authenticated student with exerciseId** — Mock MCP tools. Assert: `result.enabled === true`, `result.tools.length === 1`, `result.tools[0].name === 'getActiveExerciseContext'`

2. **returns enabled=false for guest** — Assert: `result.enabled === false`

**Acceptance criteria**:

- [ ] Shared helper works for both endpoints
- [ ] Guest/no-exerciseId → disabled
- [ ] toolExecutor validates args before calling MCP
- [ ] System prompt suffix includes exercise/block IDs

---

## Step 8: Wire Tool-Calling Into Non-Streaming Chat Endpoint

**~20 min | Spec: FR-003, FR-004, NFR-004**

**WHY**: Modify `handleContextScopedChat` to conditionally use `generateChatCompletionWithTools` when the shared helper returns `enabled: true`.

**Files to touch**:
| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/endpoints/agent/chat.ts` | MODIFIED | ~710-742 (after prompt composition) |

**Exact behavior**:

- After `composePrompt()` (~line 716), call `prepareStudentToolCalling(...)`
- If `result.enabled`:
  1. Append `result.systemPromptSuffix` to the system prompt in `composedPrompt`
  2. Get provider via `getLLMProvider()` + model config via `getProviderModelConfig()`
  3. Call `provider.generateChatCompletionWithTools({ system, messages, model, acknowledgment, tools: result.tools, toolExecutor: result.toolExecutor })`
  4. Use result text as assistant response
- If `!result.enabled`: fall through to existing `chatWithExerciseHelper()` (backward compatible)

**Tests (FAIL before, PASS after)**:

1. **Integration: authenticated student with exerciseId gets tool-calling** — Mock MCP + LLM. Send chat as student with `exerciseId` + `lessonId`. Assert: 200, `generateChatCompletionWithTools` called.

2. **Integration: guest user does NOT get tool-calling** — Send as guest with `exerciseId`. Assert: 200, `chatWithExerciseHelper` called.

**Acceptance criteria**:

- [ ] Student+exerciseId → tool-calling path
- [ ] Guest → no-tools path
- [ ] Admin → existing admin path (unchanged)
- [ ] Chat without exerciseId → existing path

**Similar pattern**: `handleAdminModeChat()` lines 370-405 in `chat.ts`

---

## Step 9: Wire Tool-Calling Into Streaming Chat Endpoint

**~20 min | Spec: FR-003, FR-007**

**WHY**: Streaming endpoint also needs tool-calling for students. Uses the same shared helper + new `generateStreamingChatCompletionWithTools`.

**Files to touch**:
| File | Status | Lines |
|------|--------|-------|
| `src/server/payload/endpoints/agent/chat-stream.ts` | MODIFIED | ~195-230 (after pipeline, before LLM call) |
| `src/infra/llm/services/exercise-chat-service.ts` | MODIFIED (add streaming+tools function) |

**Exact behavior**:

- After `runChatPipeline()` succeeds, call `prepareStudentToolCalling(...)`
- If `result.enabled`:
  1. Append `result.systemPromptSuffix` to system prompt
  2. Call new `streamChatWithExerciseHelperAndTools(input, tools, toolExecutor, payload)` which internally uses `adapter.generateStreamingChatCompletionWithTools()`
  3. Rest of SSE stream handling unchanged
- If `!result.enabled`: fall through to existing `streamChatWithExerciseHelper()`

**Tests (FAIL before, PASS after)**:

1. **Integration: student streaming with exerciseId gets tool-calling** — Mock MCP + streaming LLM. Send streaming chat as student with `exerciseId`. Assert: SSE chunks received, tool was called.

2. **Integration: streaming without exerciseId uses existing path** — Send streaming chat without `exerciseId`. Assert: `streamChatWithExerciseHelper` called (no tools).

**Acceptance criteria**:

- [ ] Student+exerciseId → streaming tool-calling
- [ ] SSE protocol unchanged (chunk/done/error)
- [ ] Tool execution invisible to client (pause in chunks)
- [ ] Backward compatible

---

## Step 10: Track `activeBlockId` in ExerciseRenderer

**~15 min | Spec: FR-006**

**WHY**: Frontend needs to know which question block was last interacted with. `ExerciseRenderer` already has `handleAnswerChange(questionId, answer)` — add a callback prop.

**Files to touch**:
| File | Status |
|------|--------|
| `src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx` | MODIFIED (add prop + calls) |
| `src/ui/web/exerciserenderer/types.ts` | MODIFIED (add to props type) |

**Exact behavior**:

- Add optional prop: `onActiveBlockChange?: (blockId: string) => void`
- In `handleAnswerChange` (line 75): call `onActiveBlockChange?.(questionId)` at start
- In `handleCheckAnswer` (line 110): call `onActiveBlockChange?.(questionId)` at start
- No internal state — parent owns the state

**Tests (FAIL before, PASS after)**:

1. **onActiveBlockChange fires on answer change** — Render with mock callback + true/false question. Simulate selecting "True". Assert: callback called with question block `id`.

2. **backward compatible** — Render without `onActiveBlockChange`. No errors.

**Acceptance criteria**:

- [ ] Callback fires on interaction
- [ ] Called with correct block `id`
- [ ] Optional (backward compatible)

---

## Step 11: Wire `activeBlockId` Through ExercisesPager → ChatInterface → useNotebookChat

**~20 min | Spec: FR-001, FR-005, FR-006, FR-007**

**WHY**: Complete the frontend pipeline. `activeBlockId` must flow from renderer up through pager and down into chat API calls.

**Files to touch**:
| File | Status |
|------|--------|
| `src/app/.../_components/ExercisesPager/index.tsx` | MODIFIED |
| `src/ui/web/chat/ChatInterface/index.tsx` | MODIFIED |
| `src/ui/web/chat/hooks/useNotebookChat.ts` | MODIFIED |

**Exact behavior**:

- **ExercisesPager**: `const [activeBlockId, setActiveBlockId] = useState<string | null>(null)`
  - `useEffect(() => setActiveBlockId(null), [pageState.exerciseIndex])` — reset on exercise navigation
  - Pass `onActiveBlockChange={setActiveBlockId}` to `ExerciseRenderer`
  - Pass `activeBlockId={activeBlockId}` to `ChatInterface`
- **ChatInterface**: Accept `activeBlockId?: string | null`, pass to `useNotebookChat`
- **useNotebookChat**: Accept `activeBlockId?: string | null`, include in context:
  ```typescript
  const context = {
    exerciseId,
    lessonId,
    chapterId,
    courseId,
    categoryId,
    activeBlockId: activeBlockId || undefined,
  }
  ```
  (Already spreads `...context` into fetch body — no api-service change needed beyond Step 2)

**Tests (FAIL before, PASS after)**:

1. **activeBlockId resets when exercise changes** — Render ExercisesPager, interact on exercise 1 (sets blockId), navigate to exercise 2. Assert: `activeBlockId` is null.

2. **activeBlockId included in API call** — Mock fetch, render ChatInterface with `activeBlockId="block-123"`, submit message. Assert: fetch body contains `activeBlockId: "block-123"`.

**Acceptance criteria**:

- [ ] Full flow from renderer → API
- [ ] Resets on exercise navigation (FR-005)
- [ ] In both streaming and non-streaming calls
- [ ] Works in split view and fullscreen (same ExercisesPager component)

---

## Step 12: End-to-End Integration Tests

**~25 min | Spec: All acceptance criteria**

**Files to touch**:
| File | Status |
|------|--------|
| `tests/int/exercise-chat-context.int.spec.ts` | NEW |

**Test cases**:

1. **student chat with exerciseId triggers tool-calling and sanitized context** — Create fixtures (student, lesson, exercise with MCQ + correctOptionIds). Mock AI to capture inputs. Send chat with `exerciseId` + `lessonId` + `activeBlockId`. Assert: 200, tool-calling used, tools contain `getActiveExerciseContext`, no correctness fields in tool output.

2. **student cannot fetch arbitrary exerciseId** — Send chat with `exerciseId: 'real-id'`. Mock LLM to invoke tool with `exerciseId: 'other-id'`. Assert: toolExecutor returns error string.

3. **guest does not get tool-calling** — Send chat as guest with `exerciseId`. Assert: `chatWithExerciseHelper` used.

4. **chat without exerciseId uses existing flow** — Send as student with `lessonId` only. Assert: `chatWithExerciseHelper` used (backward compatible).

**Acceptance criteria**:

- [ ] All 4 cases pass
- [ ] No correctness data leaks
- [ ] Backward compatibility confirmed

---

## Step 13: Quality Gates

**~15 min**

```bash
pnpm tsc --noEmit
pnpm lint
pnpm format
pnpm test:unit
pnpm test:int
pnpm generate:importmap   # if any admin components changed
```

**Manual QA**:

| #   | Scenario                                | Expected                                |
| --- | --------------------------------------- | --------------------------------------- |
| 1   | Exercise 1 → "I don't understand this"  | Chat responds with exercise 1 specifics |
| 2   | Navigate to exercise 2 → "explain this" | Chat responds about exercise 2          |
| 3   | Click MCQ option → "why is this wrong?" | Chat knows active question block        |
| 4   | DevTools → API request body             | Contains `exerciseId` + `activeBlockId` |
| 5   | Guest → message on exercise             | Works, no tool-calling                  |
| 6   | Split view layout                       | Works                                   |
| 7   | Fullscreen layout                       | Works                                   |

---

## Execution Order & Dependencies

```
Step 1 (sanitizer) ──────────┐
Step 2 (schema) ─────────────┤
Step 4 (student allowlist) ──┤
Step 5 (overrideAuth) ───────┤
Step 10 (renderer callback) ─┤
                              ▼
Step 3 (MCP tool) ─── depends on Step 1
Step 6 (streaming provider) ─ independent
Step 7 (shared helper) ─── depends on Steps 3, 4, 5
                              ▼
Step 8 (non-streaming wire) ─ depends on Step 7
Step 9 (streaming wire) ──── depends on Steps 6, 7
Step 11 (frontend wire) ──── depends on Steps 2, 10
                              ▼
Step 12 (e2e tests) ───────── depends on all above
Step 13 (quality gates) ───── depends on all above
```

**Parallelizable**: Steps 1, 2, 4, 5, 6, 10 have no mutual dependencies.
**Critical path**: 1 → 3 → 7 → 8/9
**Total estimate**: ~4.5 hours
