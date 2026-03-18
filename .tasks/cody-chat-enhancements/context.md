# Codebase Context: cody-chat-enhancements

## Files to Modify
- `src/app/api/cody/chat/route.ts` (876 lines) — Main chat API: refactor MCP init, add browser tool, dynamic prompt injection
- `src/ui/cody/components/CodyChat.tsx` (940 lines) — Chat UI: sessions integration, tool call cards, message actions, SSE parser changes
- `src/ui/cody/agents.ts` (424 lines) — Agent config: new capabilities format, browseUrl docs, mcpScope field
- `src/ui/cody/chat-types.ts` (47 lines) — Types: session index types, tool call fields on ChatMessage
- `src/app/api/cody/chat/tools/browse-url.ts` (NEW) — Playwright-based URL browsing tool
- `src/ui/cody/mcp-registry.ts` (NEW) — Declarative MCP registry config
- `src/app/api/cody/chat/mcp-manager.ts` (NEW) — MCP client lifecycle manager
- `src/ui/cody/hooks/useChatSessions.ts` (NEW) — Session CRUD hook with localStorage persistence
- `src/ui/cody/components/SessionSidebar.tsx` (NEW) — Session list UI component
- `src/ui/cody/components/TaskSessionHistory.tsx` (NEW) — Read-only task session viewer
- `src/ui/cody/components/ToolCallCard.tsx` (NEW) — Expandable tool call display card
- `src/ui/cody/components/MessageActions.tsx` (NEW) — Per-message action buttons (copy/retry/edit/delete)

## Files to Read (reference patterns)
- `src/ui/cody/remote-config.ts` — Env-var-based per-user feature config pattern (parse-once singleton)
- `src/server/payload/collections/Conversations.ts` — Session/message data model reference (archival, context scoping)
- `src/server/services/conversation-service.ts` — Get-or-create, reset, context key derivation patterns
- `src/ui/cody/components/ConfirmDialog.tsx` — Reuse for delete confirmations
- `src/ui/cody/hooks/useRemoteStatus.ts` — Pattern for polling health status from API
- `src/app/api/cody/chat/save/route.ts` — Task chat save pattern (GitHub persistence, dedup)
- `src/app/api/cody/chat/load/route.ts` — Task chat load pattern (branch resolution, session filtering)

## Key Signatures
- `createMCPClient({ transport })` from `@ai-sdk/mcp` — Creates MCP client with HTTP or stdio transport
- `tool({ description, inputSchema, execute })` from `ai` — Defines a tool for streamText
- `streamText({ model, tools, system, messages, stopWhen })` from `ai` — Streaming AI response
- `stepCountIs(n)` from `ai` — Stop condition for tool use loops
- `filterToolsByScope(scope, mcpTools, codyTools)` from `route.ts:383` — Switch-based tool filter
- `getAgent(agentId)` from `agents.ts:416` — Get agent config by ID, falls back to dashboard-manager
- `getPublicAgentList()` from `agents.ts:422` — Frontend-safe agent list (no systemPrompt)
- `isRemoteEnabled(ghUsername)` from `remote-config.ts:75` — Check if user has remote dev configured
- `requireCodyAuth(req)` from `@/ui/cody/auth` — Auth middleware for Cody endpoints
- `verifyActorLogin(req, actorLogin)` from `@/ui/cody/auth` — Verify GitHub identity matches session

## Reuse Inventory
- `src/ui/cody/remote-config.ts` → Pattern for MCP registry env-var config (parse-once Map singleton)
- `src/ui/cody/components/ConfirmDialog.tsx` → Reuse for session delete and message delete confirmations
- `@/infra/utils/logger/logger` → Logger for all API endpoints and error handling
- `cn()` from `@/utilities/cn` → Conditional Tailwind class merging in all new components
- `src/ui/cody/hooks/useRemoteStatus.ts` → Pattern for polling chat health endpoint for capability status
- `src/app/api/cody/chat/route.ts:getMCPClient()` → Singleton + dedup + race timeout pattern for MCP manager
- `src/app/api/cody/chat/route.ts:buildRemoteTools()` → Pattern for conditional tool injection with prompt extension
- `playwright` package → Already installed (v1.57.0) for E2E tests, reuse for browser tool

## Integration Points
- MCP registry replaces hardcoded MCP init in `route.ts` lines 42-153
- Browser tool registers as custom tool in `route.ts` customTools object (lines 163-371)
- Session hook replaces `globalHistory` state in `CodyChat.tsx` (lines 106-111, 135-154)
- Tool call cards replace inline JSX in `CodyChat.tsx` (lines 789-802)
- Message actions wrap existing message divs in `CodyChat.tsx` (lines 765-786)
- Dynamic tool inventory appends to system prompt after tool assembly (after line 820)
- GET endpoint enhanced to return per-MCP health (lines 661-698)
- Agent capabilities enhanced with tool/MCP mapping (agents.ts capabilities arrays)

## Imports Verified
- `@ai-sdk/mcp` → exports `createMCPClient` ✅
- `ai` → exports `streamText`, `tool`, `stepCountIs`, `ToolSet` ✅
- `@ai-sdk/google` → exports `createGoogleGenerativeAI` ✅
- `playwright` → exports `chromium` for headless browser ✅
- `@/ui/cody/agents` → exports `AgentId`, `AGENTS`, `getAgent`, `ToolScope` ✅
- `@/ui/cody/chat-types` → exports `ChatMessage`, `ChatSession`, `ChatHistory` ✅
- `@/ui/cody/auth` → exports `requireCodyAuth`, `verifyActorLogin` ✅
- `@/ui/cody/constants` → exports `GITHUB_OWNER`, `GITHUB_REPO`, `TASK_ID_REGEX` ✅
- `@/infra/utils/logger/logger` → exports `logger` ✅
- `@/utilities/cn` → exports `cn` ✅

## Architecture Notes
- Two separate chat systems: Cody Dashboard (this task) and Student AI Tutor (Conversations collection). They share NO code.
- Cody chat uses Gemini `gemini-3.1-pro-preview` via `@ai-sdk/google`
- SSE events: `text-delta`, `tool-input-start`, `tool-output-available`, `error`, `[DONE]`
- AI SDK v6 `toUIMessageStreamResponse()` generates the SSE stream
- Agent system prompts are the ONLY way the LLM knows what tools it has — dynamic injection fixes stale/inaccurate tool lists
- `createTask` tool is referenced in PRD Refiner scope but NOT implemented — this is a known gap (not part of this task)
- Global chat localStorage key is `cody-global-chat` (v1) — session migration must handle this
- Task chat is stored on GitHub branches at `.tasks/<taskId>/chat.json` — this approach is kept for task sessions
