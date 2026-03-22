# Plan: Cody Dashboard Chat Enhancements (6 Features)

## Research Findings

### File Paths Verified
- ✅ `src/app/api/cody/chat/route.ts` (876 lines) — Main chat API with MCP integration
- ✅ `src/ui/cody/components/CodyChat.tsx` (940 lines) — Chat UI component
- ✅ `src/ui/cody/agents.ts` (424 lines) — Agent definitions with ToolScope
- ✅ `src/ui/cody/chat-types.ts` (47 lines) — ChatMessage, ChatSession, ChatHistory types
- ✅ `src/ui/cody/remote-config.ts` (88 lines) — Per-user env-var config pattern to follow
- ✅ `src/ui/cody/constants.ts` — Shared constants
- ✅ `src/ui/cody/hooks/` — Existing hooks directory (12 hooks)
- ✅ `src/app/api/cody/chat/save/route.ts` — Save endpoint
- ✅ `src/app/api/cody/chat/load/route.ts` — Load endpoint
- ✅ `src/server/payload/access/` — 10 access control functions
- ✅ `src/server/payload/collections/Conversations.ts` — Reference architecture for sessions
- 🆕 `src/ui/cody/mcp-registry.ts` — New MCP registry config
- 🆕 `src/ui/cody/hooks/useChatSessions.ts` — New session management hook
- 🆕 `src/ui/cody/components/SessionSidebar.tsx` — New session list UI
- 🆕 `src/ui/cody/components/ToolCallCard.tsx` — New tool call display component
- 🆕 `src/ui/cody/components/MessageActions.tsx` — New message action buttons

### Patterns Observed
- MCP clients use module-level singleton + dedup + 5s race timeout pattern
- Tool merging: `filterToolsByScope(scope, mcpTools, customTools)` switch-based
- Remote tools pattern: conditional injection via `isRemoteEnabled()` + system prompt extension
- Remote config pattern: env var → parse-once → Map singleton → `isEnabled(user)` check
- SSE streaming: `text-delta`, `tool-input-start`, `tool-output-available`, `error`, `[DONE]`
- Messages have NO unique IDs (keyed by array index)
- Global chat persistence: localStorage per-agent; Task chat: GitHub `.tasks/<id>/chat.json`
- `createTask` is referenced in PRD Refiner's toolScope but NOT implemented in customTools

### Integration Points
- New tools register in `route.ts` customTools or via MCP registry
- New UI components mount inside `CodyChat.tsx` message list and input area
- Session management integrates with existing `globalHistory` state + localStorage
- Tool call visibility requires changes to SSE parsing in `CodyChat.tsx` (lines 472-504)
- Agent capability awareness requires changes to system prompt construction (lines 748-759)

### Key Dependencies
- `@ai-sdk/mcp: ^1.0.0` — Already installed, MCP client creation
- `@modelcontextprotocol/sdk: >=1.25.2` — Already installed, MCP protocol
- `ai: ^6.0.97` — AI SDK v6, `streamText`, `tool`, `stepCountIs`
- `playwright: 1.57.0` — Already installed for E2E tests, can reuse for browser tool
- No new npm packages needed for Features 1-6

## Reuse Inventory

### Existing Code to Reuse
- `src/ui/cody/remote-config.ts` → Pattern for env-var-based MCP registry config
- `src/app/api/cody/chat/route.ts:getMCPClient()` → Singleton + dedup + timeout pattern
- `src/app/api/cody/chat/route.ts:filterToolsByScope()` → Tool scope filtering
- `src/app/api/cody/chat/route.ts:buildRemoteTools()` → Pattern for conditional tool injection
- `src/ui/cody/agents.ts:REMOTE_SYSTEM_PROMPT_EXTENSION` → Pattern for dynamic prompt extension
- `src/ui/cody/chat-types.ts:ChatSession` → Session type to extend
- `src/ui/cody/components/ConfirmDialog.tsx` → Reuse for session delete confirmation
- `@/infra/utils/logger/logger` → Logger for API endpoints

### New Code Justified
- **MCP Registry** (`mcp-registry.ts`): No existing registry pattern; current code hardcodes MCP init in route handler
- **Session management hook** (`useChatSessions.ts`): No existing session listing/switching for Cody chat
- **Tool call card** (`ToolCallCard.tsx`): Current tool display is inline 5-line JSX, needs proper component
- **Message actions** (`MessageActions.tsx`): No existing message-level interaction UI
- **Browser tool**: No existing web-fetching capability in the chat tools

---

## Feature 1: Web Browsing / URL Reading Tool

### Overview
Add a `browseUrl` tool that uses headless Playwright to fetch and render JS-heavy pages, returning readable content to the LLM. This directly solves the "I cannot browse URLs" gap.

### Step 1.1: Create Browser Tool Module

**Files to Touch**:
- `src/app/api/cody/chat/tools/browse-url.ts` (NEW)

**Behavior**:
- Export a `browseUrl` tool using AI SDK `tool()` with Zod schema:
  - Input: `{ url: z.string().url(), selector?: z.string() }`
  - `url`: The page to browse (must be valid URL)
  - `selector`: Optional CSS selector to extract specific content (defaults to `body`)
- Implementation:
  1. Launch headless Chromium via `playwright` (import `chromium` from `playwright`)
  2. Navigate to the URL with a 15s timeout
  3. Wait for `networkidle` (handles JS-rendered content like Figma sites)
  4. Extract page title via `page.title()`
  5. Extract text content: if `selector` provided, use `page.locator(selector).innerText()`; otherwise use `page.evaluate(() => document.body.innerText)`
  6. Truncate to 50KB to stay within context limits
  7. Return `{ title, url, content, truncated: boolean }`
  8. Close browser context in `finally` block
- **Security**:
  - URL allowlist: Block `localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.*`, `10.*`, `172.16-31.*`, `192.168.*` (SSRF prevention)
  - Timeout: 15s max per page load
  - Content cap: 50KB max returned to LLM
  - No cookie persistence between calls (fresh context each time)
- **Error handling**: Return `{ error: string }` on failure (timeout, blocked URL, navigation error) — never throw

**Tests** (FAIL before, PASS after):
- `tests/unit/cody/tools/browse-url.test.ts`:
  - Test: `browseUrl blocks localhost URLs` — call with `http://localhost:3000`, expect `{ error: 'URL blocked' }`
  - Test: `browseUrl blocks private IP ranges` — call with `http://192.168.1.1`, expect error
  - Test: `browseUrl returns content from public URL` — mock playwright page, verify title + content extraction
  - Test: `browseUrl truncates content over 50KB` — mock page returning 100KB, verify `truncated: true` and content ≤ 50KB
  - Test: `browseUrl handles navigation timeout` — mock page.goto that throws timeout, verify `{ error }` returned

**Acceptance Criteria**:
- [ ] `browseUrl` tool is exported and can be imported
- [ ] SSRF protection blocks all private/internal IPs
- [ ] JS-rendered pages (networkidle) are properly extracted
- [ ] Content is capped at 50KB
- [ ] Errors return structured `{ error }` objects, never throw

### Step 1.2: Integrate Browser Tool into Chat Route

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — lines 163-371 customTools, lines 816-829 tool injection)

**Behavior**:
- Import `browseUrl` from `./tools/browse-url`
- Add `browseUrl` to the `customTools` object (alongside `listCodyTasks`, `getCodyTask`, etc.)
- This makes it available to all agents with `toolScope: 'all'` (Dashboard Manager)
- For `mcp-only` and `mcp-and-task-create` agents, `browseUrl` is NOT available (they only get MCP tools)
- Update the Dashboard Manager system prompt (in `agents.ts`) to document the new tool

**Tests**:
- `tests/unit/cody/chat-route-tools.test.ts`:
  - Test: `browseUrl tool is included for dashboard-manager agent` — verify `filterToolsByScope('all', mcpTools, customTools)` includes `browseUrl`
  - Test: `browseUrl tool is excluded for mcp-only agents` — verify `filterToolsByScope('mcp-only', ...)` does NOT include `browseUrl`

**Acceptance Criteria**:
- [ ] Dashboard Manager agent can use `browseUrl` tool
- [ ] System Architect and PRD Refiner do NOT get `browseUrl` (preserves their focused scope)
- [ ] System prompt documents the tool's capabilities

### Step 1.3: Update Agent System Prompts

**Files to Touch**:
- `src/ui/cody/agents.ts` (MODIFIED — Dashboard Manager systemPrompt, lines 56-95)

**Behavior**:
- Add `browseUrl` to the Dashboard Manager's tool documentation in the system prompt:
  ```
  **Web Browsing Tools**:
  - browseUrl: Fetch and read any public web page (handles JavaScript-rendered content).
    Use for reading Figma sites, documentation, error pages, or any URL the user shares.
  ```
- Add to the `capabilities` array: `'Browse and read any public web page or URL'`
- Add to the Tool Selection Rules: `For URL reading, web content → use browseUrl`

**Tests**:
- `tests/unit/cody/agents.test.ts`:
  - Test: `dashboard-manager capabilities include web browsing` — verify capabilities array contains URL-related entry
  - Test: `dashboard-manager systemPrompt mentions browseUrl` — verify prompt string includes `browseUrl`

**Acceptance Criteria**:
- [ ] Dashboard Manager's capabilities list mentions URL browsing
- [ ] System prompt instructs the LLM when and how to use `browseUrl`
- [ ] The LLM should proactively use this tool when a user pastes a URL

---

## Feature 2: Pluggable MCP Tool Registry

### Overview
Refactor hardcoded MCP client initialization into a declarative registry. Each MCP is defined as a config entry with transport, enablement condition, and scope. The chat route iterates the registry instead of managing each MCP individually.

### Step 2.1: Create MCP Registry Config Module

**Files to Touch**:
- `src/ui/cody/mcp-registry.ts` (NEW)

**Behavior**:
- Define `MCPConfig` interface:
  ```typescript
  interface MCPConfig {
    id: string                          // e.g., 'github', 'figma', 'browser'
    name: string                        // Human-readable name
    description: string                 // What this MCP provides
    transport: () => MCPTransportConfig // Lazy transport config (may depend on env vars)
    enabled: () => boolean              // Whether this MCP should be initialized
    toolPrefix?: string                 // Optional prefix to namespace tool names
    timeoutMs?: number                  // Init timeout (default: 5000)
    scope?: AgentId[]                   // Which agents get these tools (default: all agents)
    systemPromptExtension?: string      // Additional prompt text when this MCP is active
  }
  ```
- Define `MCPTransportConfig`:
  ```typescript
  type MCPTransportConfig =
    | { type: 'http'; url: string; headers?: Record<string, string> }
    | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  ```
- Export `MCP_REGISTRY: MCPConfig[]` with three entries:
  1. **github**: HTTP transport to `https://api.githubcopilot.com/mcp/`, enabled when `GH_PAT || GITHUB_TOKEN` is set
  2. **figma**: Stdio transport spawning `npx figma-developer-mcp`, enabled when `FIGMA_API_KEY` is set
  3. Extensible — adding a new MCP is adding one object to the array
- Export helper: `getEnabledMCPs(): MCPConfig[]` — filters by `enabled()`
- Export helper: `getMCPsForAgent(agentId: AgentId): MCPConfig[]` — filters by `scope` (or returns all if scope is undefined)

**Tests**:
- `tests/unit/cody/mcp-registry.test.ts`:
  - Test: `registry returns github MCP when GH_PAT is set` — mock env, verify `getEnabledMCPs()` includes github
  - Test: `registry excludes figma MCP when FIGMA_API_KEY is missing` — mock env without key, verify figma excluded
  - Test: `getMCPsForAgent filters by scope` — configure an MCP with `scope: ['dashboard-manager']`, verify it's excluded for `system-architect`
  - Test: `registry entries have valid transport configs` — iterate all entries, verify transport function returns valid config

**Acceptance Criteria**:
- [ ] Adding a new MCP requires only adding one config object to the array
- [ ] Enablement is declarative via `enabled()` function
- [ ] Per-agent scoping works via optional `scope` field
- [ ] All existing MCPs (GitHub, Figma) are represented in the registry

### Step 2.2: Create MCP Client Manager

**Files to Touch**:
- `src/app/api/cody/chat/mcp-manager.ts` (NEW)

**Behavior**:
- Export `MCPManager` class (singleton pattern):
  ```typescript
  class MCPManager {
    private clients: Map<string, MCPClientEntry>
    async getTools(agentId: AgentId): Promise<ToolSet>
    async getHealthStatus(): Promise<MCPHealthStatus[]>
    dispose(): void
  }
  ```
- `MCPClientEntry`: `{ config: MCPConfig, client: MCPClient | null, pending: Promise | null, lastError: Error | null }`
- `getTools(agentId)`:
  1. Get MCPs for this agent via `getMCPsForAgent(agentId)`
  2. For each enabled MCP, initialize client if not cached (following existing singleton + dedup pattern from `getMCPClient()`)
  3. Race each client's `tools()` call against `config.timeoutMs` (default 5s)
  4. On timeout or error: log warning, skip this MCP (graceful degradation)
  5. Merge all tool objects into one `ToolSet`, applying `toolPrefix` if configured
  6. Return merged tools
- `getHealthStatus()`: Return array of `{ id, name, enabled, connected, toolCount, lastError }`
- `dispose()`: Clean up Figma child processes, close connections
- **Figma stdio transport**: Move the `spawn` + port-polling logic from `route.ts` into the manager. The manager handles process lifecycle and cleanup.
- Module-level singleton: `let manager: MCPManager | null = null; export function getMCPManager(): MCPManager`

**Tests**:
- `tests/unit/cody/mcp-manager.test.ts`:
  - Test: `getTools returns merged tools from multiple MCPs` — mock two MCP clients with different tools, verify all merged
  - Test: `getTools handles MCP timeout gracefully` — mock one MCP that times out, verify other MCP's tools still returned
  - Test: `getTools caches clients across calls` — call twice, verify `createMCPClient` called once
  - Test: `getTools retries after failure` — first call fails, clear pending, second call succeeds
  - Test: `getHealthStatus reports all MCP statuses` — verify status includes enabled, connected, toolCount

**Acceptance Criteria**:
- [ ] Single `getTools(agentId)` call replaces all MCP init code in route.ts
- [ ] Timeout, caching, and dedup patterns are preserved from current implementation
- [ ] Graceful degradation: one MCP failure doesn't block others
- [ ] Health status endpoint can report per-MCP status

### Step 2.3: Refactor Chat Route to Use MCP Manager

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — major refactor of lines 42-153 and 762-829)

**Behavior**:
- Remove: Module-level `mcpClient`, `mcpClientPending`, `figmaMcpClient`, `figmaMcpProcessRef` variables
- Remove: `getMCPClient()`, `getFigmaMCPClient()`, `cleanupFigmaMCPProcess()` functions
- Remove: Process cleanup event handlers (lines 89-91)
- Replace: MCP initialization block (lines 762-829) with:
  ```typescript
  const mcpManager = getMCPManager()
  const mcpTools = await mcpManager.getTools(agent.id as AgentId)
  let allTools = filterToolsByScope(agent.toolScope, mcpTools, customTools) as ToolSet
  // Remote tools injection stays as-is
  ```
- Update: GET handler (lines 661-698) to use `mcpManager.getHealthStatus()`:
  ```typescript
  const healthStatuses = await mcpManager.getHealthStatus()
  return NextResponse.json({
    status: 'Chat endpoint ready',
    mcps: healthStatuses,
    toolCount: totalToolCount,
  })
  ```
- **SystemPrompt extension**: If any active MCP has `systemPromptExtension`, append it to the system prompt (following the remote tools pattern)

**Tests**:
- `tests/int/cody/chat-route.int.spec.ts`:
  - Test: `GET /api/cody/chat returns MCP health status` — verify response includes `mcps` array
  - Test: `POST /api/cody/chat works with no MCPs available` — mock all MCPs disabled, verify custom tools still work
  - Test: `POST /api/cody/chat includes MCP tools for dashboard-manager` — verify merged toolset

**Acceptance Criteria**:
- [ ] Route.ts is ~100 lines shorter (MCP init code moved to manager)
- [ ] All existing MCP functionality preserved (GitHub, Figma, remote)
- [ ] Adding a new MCP requires zero changes to route.ts
- [ ] GET endpoint reports per-MCP health status
- [ ] No behavioral regression in chat responses

### Step 2.4: Update ToolScope to Support MCP Scoping

**Files to Touch**:
- `src/ui/cody/agents.ts` (MODIFIED — ToolScope type, agent configs)

**Behavior**:
- Keep existing `ToolScope` type as-is (it controls custom tool access)
- Add new optional field to `AgentConfig`:
  ```typescript
  /** Which MCPs this agent can use (default: all enabled MCPs) */
  mcpScope?: string[]  // MCP IDs from registry, e.g., ['github', 'figma']
  ```
- Dashboard Manager: `mcpScope: undefined` (all MCPs)
- PRD Refiner: `mcpScope: ['github']` (no Figma, no browser)
- System Architect: `mcpScope: ['github', 'figma']` (needs both for design analysis)
- The `MCPManager.getTools()` uses this to further filter which MCP tools each agent sees

**Tests**:
- `tests/unit/cody/agents.test.ts`:
  - Test: `agent configs have valid mcpScope values` — verify all mcpScope entries reference known MCP IDs

**Acceptance Criteria**:
- [ ] Each agent can be independently scoped to specific MCPs
- [ ] Default (undefined) means access to all enabled MCPs
- [ ] No breaking changes to existing ToolScope behavior

---

## Feature 3: Session Management

### Overview
Add session listing, creation, naming, and switching for global (non-task) chat. For task chat, add a read-only session history view showing pipeline + dashboard sessions. All persistence stays in localStorage (global) and GitHub (task) — no new database collections.

**Design Decision**: Recommend Option 3 — Full session management for global chat + read-only session history for tasks. Rationale: Global chat is where users lose context most (localStorage is flat). Task chat already has good scoping by task ID; adding multi-session complicates GitHub persistence unnecessarily.

### Step 3.1: Extend Chat Types for Session Index

**Files to Touch**:
- `src/ui/cody/chat-types.ts` (MODIFIED — add session index types)

**Behavior**:
- Add new types:
  ```typescript
  /** Lightweight session metadata for the session list */
  interface SessionMeta {
    id: string              // UUID
    agentId: AgentId        // Which agent this session belongs to
    title: string           // Auto-generated or user-edited
    createdAt: string       // ISO timestamp
    updatedAt: string       // Last message timestamp
    messageCount: number    // For display
    pinned?: boolean        // Sticky sessions
  }

  /** localStorage structure for global sessions */
  interface GlobalChatStore {
    version: 2
    sessions: SessionMeta[]          // Session index (lightweight)
    messages: Record<string, Message[]>  // Session ID -> messages
    activeSessionId: Record<AgentId, string>  // Per-agent active session
  }
  ```
- Existing types (`ChatMessage`, `ChatSession`, `ChatHistory`) remain unchanged for backward compatibility

**Tests**:
- Type-level validation only (TypeScript compiler). No runtime tests needed for pure types.

**Acceptance Criteria**:
- [ ] New types are exported and importable
- [ ] Backward compatible with existing `ChatHistory` type
- [ ] `GlobalChatStore` supports multiple sessions per agent

### Step 3.2: Create Session Management Hook

**Files to Touch**:
- `src/ui/cody/hooks/useChatSessions.ts` (NEW)

**Behavior**:
- Export `useChatSessions(agentId: AgentId)` hook returning:
  ```typescript
  {
    sessions: SessionMeta[]           // All sessions for this agent, sorted by updatedAt desc
    activeSession: SessionMeta | null // Currently active session
    messages: Message[]               // Messages for active session
    setMessages: (msgs: Message[] | (prev: Message[]) => Message[]) => void
    createSession: () => string       // Returns new session ID
    switchSession: (id: string) => void
    renameSession: (id: string, title: string) => void
    deleteSession: (id: string) => void
    pinSession: (id: string) => void
    clearActiveSession: () => void    // Clear messages of active session
  }
  ```
- **Storage**: localStorage key `cody-sessions-v2`
- **Migration**: On first load, detect old `cody-global-chat` key (v1 format). Migrate existing per-agent messages into a single "Imported conversation" session per agent. Delete old key.
- **Auto-title**: When `createSession()` is called, title defaults to `"New conversation"`. After the first user message is sent (externally by CodyChat), the title updates to the first 60 chars of that message.
- **Session limit**: Max 50 sessions per agent. When exceeded, auto-delete oldest non-pinned session.
- **Persistence**: Debounced 1s write to localStorage (following existing pattern)

**Tests**:
- `tests/unit/cody/hooks/useChatSessions.test.ts`:
  - Test: `createSession creates new session with default title` — call createSession, verify SessionMeta created
  - Test: `switchSession loads correct messages` — create 2 sessions with different messages, switch between them
  - Test: `deleteSession removes session and messages` — create and delete, verify both gone
  - Test: `renameSession updates title` — create, rename, verify title changed
  - Test: `migration converts v1 format to v2` — set old localStorage format, init hook, verify migration
  - Test: `session limit auto-deletes oldest` — create 51 sessions, verify oldest non-pinned deleted
  - Test: `pinSession prevents auto-deletion` — pin a session, verify it survives limit cleanup

**Acceptance Criteria**:
- [ ] Multiple independent sessions per agent
- [ ] Switching sessions preserves all messages
- [ ] Migration from v1 localStorage format is seamless
- [ ] Session limit prevents unbounded storage growth
- [ ] Pinned sessions survive auto-cleanup

### Step 3.3: Create Session Sidebar Component

**Files to Touch**:
- `src/ui/cody/components/SessionSidebar.tsx` (NEW)

**Behavior**:
- Slide-in panel (left side within the chat area) or dropdown list below the agent selector
- Shows sessions for the current agent, sorted by `updatedAt` desc
- Each session row shows:
  - Title (editable inline on double-click)
  - Time ago (e.g., "2h ago", "Yesterday")
  - Message count badge
  - Pin icon (toggle)
  - Delete icon (with confirmation via `ConfirmDialog`)
- "New conversation" button at the top (calls `createSession`)
- Active session highlighted with accent background
- Clicking a session calls `switchSession(id)`
- Compact design: each row ~40px height, max visible without scrolling ~8 sessions
- Uses Tailwind classes only, `cn()` for conditional styling
- Reuses `ConfirmDialog` from `src/ui/cody/components/ConfirmDialog.tsx`

**Tests**:
- `tests/unit/cody/components/SessionSidebar.test.tsx`:
  - Test: `renders session list sorted by updatedAt` — provide 3 sessions, verify order
  - Test: `clicking session calls switchSession` — click a session row, verify callback called with correct ID
  - Test: `new conversation button calls createSession` — click button, verify callback
  - Test: `delete shows confirmation dialog` — click delete icon, verify ConfirmDialog appears
  - Test: `active session is highlighted` — verify active session has accent class

**Acceptance Criteria**:
- [ ] Sessions are listed with title, time, and count
- [ ] Active session is visually highlighted
- [ ] New session creation works from the sidebar
- [ ] Delete requires confirmation
- [ ] Inline rename works on double-click

### Step 3.4: Integrate Sessions into CodyChat

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — replace globalHistory state with useChatSessions)

**Behavior**:
- **Replace**: `globalHistory` state + `loadGlobalHistory` + `saveGlobalHistory` with `useChatSessions(selectedAgent)` hook
- **Replace**: Global mode `messages` derived from `globalHistory[selectedAgent]` with `sessions.messages`
- **Replace**: `setMessages` in global mode with `sessions.setMessages`
- **Replace**: Clear history in global mode with `sessions.clearActiveSession()`
- **Add**: Session sidebar toggle button in the header (list icon, next to agent switch)
- **Add**: `useState<boolean>` for `showSessionSidebar`
- **Add**: Render `SessionSidebar` conditionally when `showSessionSidebar && !isTaskMode`
- **Task mode**: No change — `taskMessages` state remains as-is
- **Agent switch**: When agent changes, `useChatSessions` automatically switches to that agent's active session
- **Auto-title**: After `sendText` returns for the first message in a new session, call `renameSession(activeSession.id, input.slice(0, 60))`

**Tests**:
- `tests/unit/cody/components/CodyChat-sessions.test.tsx`:
  - Test: `session sidebar toggle button appears in global mode` — verify button is rendered
  - Test: `session sidebar is hidden in task mode` — verify no sidebar when selectedTask is set
  - Test: `switching sessions loads different messages` — switch session, verify messages change
  - Test: `creating new session clears messages` — click new session, verify empty messages
  - Test: `auto-title updates after first message` — send a message, verify session title matches

**Acceptance Criteria**:
- [ ] Global chat supports multiple sessions per agent
- [ ] Session sidebar is accessible but not intrusive (toggled via icon)
- [ ] Task mode is completely unaffected
- [ ] Migration from v1 localStorage is transparent to users
- [ ] Agent switching loads the correct agent's active session

### Step 3.5: Add Task Session History View

**Files to Touch**:
- `src/ui/cody/components/TaskSessionHistory.tsx` (NEW)

**Behavior**:
- Read-only view showing ALL sessions from the task's `chat.json` (pipeline + dashboard)
- Displayed as an expandable section above the chat messages when in task mode
- Each session shows:
  - Stage label (e.g., "🔧 build", "📋 spec", "💬 dashboard") with color coding
  - Started at timestamp
  - Message count
  - Expandable: click to view messages read-only (collapsed by default)
- Pipeline sessions show tool names used (from `ChatMessage.tools`)
- Dashboard sessions are shown but the current active dashboard session is labeled "Current"
- Uses the existing `GET /api/cody/chat/load` endpoint (which already returns all sessions)

**Tests**:
- `tests/unit/cody/components/TaskSessionHistory.test.tsx`:
  - Test: `renders pipeline and dashboard sessions` — provide mixed sessions, verify all shown
  - Test: `sessions are labeled with stage names` — verify stage labels displayed
  - Test: `sessions expand on click to show messages` — click session, verify messages visible
  - Test: `current dashboard session labeled as Current` — verify label

**Acceptance Criteria**:
- [ ] All task sessions (pipeline + dashboard) are visible
- [ ] Each session has a clear stage label and timestamp
- [ ] Messages are expandable (collapsed by default to save space)
- [ ] Read-only — no editing or deletion of task sessions

---

## Feature 4: Tool Call Visibility & Results

### Overview
Enhance tool call display from a simple name list to expandable cards showing input parameters, execution status, and results. Persist tool calls in chat history.

### Step 4.1: Extend SSE Protocol for Tool Results

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — SSE parser, lines 472-504)
- `src/ui/cody/chat-types.ts` (MODIFIED — add tool call fields to ChatMessage)

**Behavior**:
- Extend `ChatMessage` type:
  ```typescript
  interface ChatMessage {
    // ... existing fields
    toolCalls?: Array<{
      name: string
      arguments: Record<string, unknown>
      result?: unknown
      status: 'running' | 'success' | 'error'
      durationMs?: number
    }>
  }
  ```
- Extend `ToolCall` interface in CodyChat.tsx:
  ```typescript
  interface ToolCall {
    name: string
    arguments: Record<string, unknown>
    result?: unknown
    status: 'running' | 'success' | 'error'
    startedAt: number  // Date.now() for duration tracking
  }
  ```
- Update SSE parser to handle additional events from AI SDK v6:
  - `tool-input-start`: Create tool call with `status: 'running'` (existing)
  - `tool-input-delta`: Accumulate tool arguments (NEW — update arguments incrementally)
  - `tool-output-available` / `tool-result`: Update tool call with result and `status: 'success'` (currently a no-op, make it functional)
  - On stream error after tool call: mark tool as `status: 'error'`
- **Duration tracking**: Record `startedAt` on `tool-input-start`, compute `durationMs` on result

**Tests**:
- `tests/unit/cody/sse-parser.test.ts`:
  - Test: `tool-input-start creates running tool call` — parse event, verify status is 'running'
  - Test: `tool-result updates tool call with result and success status` — parse result event, verify tool updated
  - Test: `duration is calculated correctly` — verify durationMs = result time - start time
  - Test: `tool calls are persisted in saved messages` — verify toolCalls array included when saving

**Acceptance Criteria**:
- [ ] Tool calls track status transitions: running → success/error
- [ ] Tool results are captured (not discarded)
- [ ] Duration is tracked per tool call
- [ ] Tool call data is persisted in chat history

### Step 4.2: Create ToolCallCard Component

**Files to Touch**:
- `src/ui/cody/components/ToolCallCard.tsx` (NEW)

**Behavior**:
- Replaces the inline 10-line tool display (CodyChat.tsx lines 789-802)
- Props: `toolCall: ToolCall, expanded?: boolean`
- Display:
  - **Header**: Tool name + status indicator (⏳ running, ✅ success, ❌ error) + duration badge
  - **Collapsed** (default): Just the header line
  - **Expanded** (click to toggle):
    - Input section: JSON-formatted tool arguments (syntax highlighted or code block)
    - Result section: JSON-formatted result (truncated to 500 chars with "Show more")
  - Tool names are formatted nicely: `get_file_contents` → `Get File Contents`
- **Styling**: Rounded card with left border color based on status (blue=running, green=success, red=error)
- **Animations**: Smooth expand/collapse transition

**Tests**:
- `tests/unit/cody/components/ToolCallCard.test.tsx`:
  - Test: `renders tool name and status` — provide running tool call, verify name and ⏳ shown
  - Test: `expands on click to show arguments` — click card, verify arguments section visible
  - Test: `shows result when status is success` — provide completed tool call, verify result shown
  - Test: `formats tool names` — verify `get_file_contents` rendered as `Get File Contents`
  - Test: `truncates long results` — provide 1000-char result, verify truncation + "Show more"

**Acceptance Criteria**:
- [ ] Tool calls are displayed as interactive cards
- [ ] Cards expand to show arguments and results
- [ ] Status is visually indicated (running/success/error)
- [ ] Duration is shown when available
- [ ] Long results are truncated with expand option

### Step 4.3: Integrate ToolCallCards into Message Flow

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — replace inline tool display, lines 789-802)

**Behavior**:
- Replace the inline `toolCalls.map` JSX block with `<ToolCallCard>` components
- Tool call cards render inline within the assistant message bubble (not below all messages)
- When an assistant message has associated tool calls, they appear between the tool invocation point and the text response
- **Association**: Tool calls are grouped with the assistant message they belong to. The `toolCalls` state is cleared per-message and associated when the assistant message completes.
- After streaming completes, tool call data is merged into the assistant message's `toolCalls` array for persistence

**Tests**:
- `tests/unit/cody/components/CodyChat-tools.test.tsx`:
  - Test: `tool calls render as ToolCallCard components` — verify ToolCallCard is rendered for each tool call
  - Test: `tool calls appear within assistant message` — verify tool cards are inside the message container

**Acceptance Criteria**:
- [ ] Old inline tool list is replaced with ToolCallCard components
- [ ] Tool calls are visually associated with their assistant message
- [ ] Tool call data persists across sessions (via chat history)

---

## Feature 5: Message-Level Actions

### Overview
Add per-message action buttons for copy, retry/regenerate, edit & resend, and delete.

### Step 5.1: Create MessageActions Component

**Files to Touch**:
- `src/ui/cody/components/MessageActions.tsx` (NEW)

**Behavior**:
- Floating action bar that appears on message hover (or tap on mobile)
- Props:
  ```typescript
  interface MessageActionsProps {
    message: Message
    index: number
    isLast: boolean
    isLoading: boolean
    onCopy: () => void
    onRetry: () => void           // Only for last assistant message
    onEdit: (content: string) => void  // Only for user messages
    onDelete: () => void
  }
  ```
- **Actions by message type**:
  - **User messages**: Copy | Edit | Delete
  - **Assistant messages**: Copy | Retry (only if last) | Delete
- **Copy**: Copies raw markdown content to clipboard via `navigator.clipboard.writeText()`. Shows brief "Copied!" tooltip.
- **Retry**: Only shown on the LAST assistant message. Calls `onRetry` which re-sends the previous user message.
- **Edit**: Only on user messages. Replaces message content with an editable textarea. On submit, truncates conversation from this point and resends.
- **Delete**: Removes the message (with confirmation for assistant messages that have tool calls)
- **Positioning**: Absolute positioned at top-right corner of message, appears on hover with opacity transition
- **Mobile**: Tap message to toggle action visibility (no hover on touch devices)

**Tests**:
- `tests/unit/cody/components/MessageActions.test.tsx`:
  - Test: `shows Copy for all message types` — verify copy button always present
  - Test: `shows Retry only for last assistant message` — verify retry shown when isLast=true and role=assistant
  - Test: `hides Retry for non-last assistant messages` — verify retry hidden when isLast=false
  - Test: `shows Edit only for user messages` — verify edit button for user role only
  - Test: `copy calls onCopy callback` — click copy, verify callback fired
  - Test: `delete calls onDelete callback` — click delete, verify callback fired

**Acceptance Criteria**:
- [ ] Actions appear on hover (desktop) or tap (mobile)
- [ ] Copy works for all message types
- [ ] Retry only appears on the last assistant message
- [ ] Edit only appears on user messages
- [ ] Delete works with confirmation for messages with tool calls

### Step 5.2: Implement Retry/Regenerate Logic

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — add retry handler)

**Behavior**:
- Add `handleRetry()` callback:
  1. Find the last user message in the conversation
  2. Remove the last assistant message (the one being retried)
  3. Call `sendText(lastUserMessage.content)` to regenerate
- This effectively "resends" the last user message to get a different response
- During retry, the loading state and abort controller work exactly as for a new message

**Tests**:
- `tests/unit/cody/components/CodyChat-retry.test.ts`:
  - Test: `handleRetry removes last assistant message and resends` — trigger retry, verify message removed and sendText called
  - Test: `handleRetry is disabled during loading` — verify retry callback is no-op when loading=true

**Acceptance Criteria**:
- [ ] Clicking retry on the last assistant message regenerates it
- [ ] The previous assistant response is removed before regeneration
- [ ] Loading/abort behavior is consistent with normal message sending

### Step 5.3: Implement Edit & Resend Logic

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — add edit handler)

**Behavior**:
- Add `handleEdit(index: number, newContent: string)` callback:
  1. Truncate messages from index onward (remove edited message + all subsequent messages)
  2. Call `sendText(newContent)` to send the edited message as a new turn
- **Edit UI flow** (managed in MessageActions):
  1. User clicks Edit → message content becomes editable textarea
  2. User edits text → presses Enter or clicks ✓ to confirm
  3. On confirm → `handleEdit(index, editedText)` called
  4. On cancel (Esc or click ✗) → revert to original content

**Tests**:
- `tests/unit/cody/components/CodyChat-edit.test.ts`:
  - Test: `handleEdit truncates conversation and resends` — edit message at index 2 in a 5-message conversation, verify messages truncated to 2 and sendText called
  - Test: `edit preserves messages before the edited one` — verify messages at indices 0 and 1 remain unchanged

**Acceptance Criteria**:
- [ ] Editing a user message truncates the conversation from that point
- [ ] The edited content is sent as a new message
- [ ] Messages before the edited one are preserved
- [ ] Cancel reverts without changes

### Step 5.4: Integrate MessageActions into Message Rendering

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — message rendering, lines 765-786)

**Behavior**:
- Wrap each message `<div>` in a `relative group` container
- Render `<MessageActions>` inside each message container, positioned absolute at top-right
- Pass appropriate callbacks:
  - `onCopy`: `() => navigator.clipboard.writeText(msg.content)`
  - `onRetry`: `() => handleRetry()` (only for last assistant message)
  - `onEdit`: `(content) => handleEdit(i, content)` (only for user messages)
  - `onDelete`: `() => handleDelete(i)` (removes message at index)
- Add `handleDelete(index: number)`: removes message at index via `setMessages(prev => prev.filter((_, j) => j !== index))`
- Actions hidden during loading state
- Add message IDs: Generate UUID for each message on creation (needed for stable React keys when messages are deleted)

**Tests**:
- `tests/unit/cody/components/CodyChat-actions.test.tsx`:
  - Test: `MessageActions rendered for each message` — verify actions component exists for every message
  - Test: `delete removes message at correct index` — delete middle message, verify correct one removed
  - Test: `actions hidden during loading` — verify no actions rendered when loading=true

**Acceptance Criteria**:
- [ ] Every message has hover-accessible actions
- [ ] Copy, retry, edit, delete all function correctly
- [ ] Actions don't appear during active streaming
- [ ] Messages use stable IDs (not array indices) as React keys

---

## Feature 6: Agent Capability Awareness

### Overview
Make agents self-aware of their available tools and teach them to suggest missing capabilities instead of just saying "I cannot." Also show users what each agent can do based on currently available tools.

### Step 6.1: Dynamic Tool List Injection in System Prompt

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — system prompt construction, after line 820)

**Behavior**:
- After `allTools` is assembled (line 820), generate a dynamic tool inventory:
  ```typescript
  const toolNames = Object.keys(allTools)
  const toolInventory = `\n\n## Your Available Tools (${toolNames.length})\n\n` +
    toolNames.map(name => `- ${name}`).join('\n') +
    `\n\nIMPORTANT: If a user asks you to do something and you don't have a tool for it, ` +
    `explicitly say which tool or capability would be needed. Never say "I cannot" without ` +
    `explaining what's missing. If the user shares a URL, use the browseUrl tool to read it.`
  systemPrompt += toolInventory
  ```
- This replaces the static tool lists in agent system prompts with dynamic, accurate tool lists
- The LLM now knows EXACTLY which tools it has at runtime (not a stale list from the prompt)
- Add a **capability gap instruction**: When the agent can't fulfill a request, it should name the missing tool/MCP and suggest alternatives

**Tests**:
- `tests/unit/cody/chat-route-capability.test.ts`:
  - Test: `system prompt includes dynamic tool list` — construct prompt with known tools, verify all tool names appear
  - Test: `tool list reflects actual available tools` — mock MCPs returning specific tools, verify those names in prompt
  - Test: `capability gap instruction is included` — verify the "never say I cannot" instruction is in the prompt

**Acceptance Criteria**:
- [ ] System prompt includes exact list of currently available tools
- [ ] Tool list is dynamic (changes if MCPs are unavailable)
- [ ] Agents instructed to explain capability gaps instead of flat "I cannot"

### Step 6.2: Agent Capability Cards in Chat UI

**Files to Touch**:
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — empty state, lines 726-757)
- `src/app/api/cody/chat/route.ts` (MODIFIED — GET endpoint, lines 661-698)

**Behavior**:
- **GET endpoint enhancement**: Include per-agent tool availability:
  ```typescript
  return NextResponse.json({
    status: 'Chat endpoint ready',
    mcps: healthStatuses,
    agents: Object.fromEntries(
      Object.keys(AGENTS).map(agentId => [
        agentId,
        { toolCount: agentToolCounts[agentId], mcps: agentMcpNames[agentId] }
      ])
    ),
  })
  ```
- **Client-side**: Fetch tool availability on mount (or use the health check polling)
- **Empty state update**: Replace static capability list with dynamic cards:
  - ✅ Green badge for available capabilities (tool exists)
  - 🔴 Red badge for unavailable capabilities (MCP not connected)
  - Example: `✅ Browse repository files` / `✅ Browse web URLs` / `🔴 Figma design analysis (Figma MCP offline)`
- **Agent selector enhancement**: In the agent dropdown, show tool count per agent: `📊 Dashboard Manager (23 tools)` / `📝 PRD Refiner (15 tools)`

**Tests**:
- `tests/unit/cody/components/CodyChat-capability.test.tsx`:
  - Test: `empty state shows dynamic capabilities` — mock health check response, verify green/red badges
  - Test: `agent dropdown shows tool counts` — verify tool count displayed in dropdown
  - Test: `unavailable MCPs shown with red badge` — mock MCP offline, verify red badge

**Acceptance Criteria**:
- [ ] Users see which capabilities are currently available (green) vs unavailable (red)
- [ ] Agent dropdown shows tool count per agent
- [ ] Empty state is dynamic, not static
- [ ] When an MCP goes offline, the UI reflects it

### Step 6.3: Add Agent-Specific Capability Descriptions

**Files to Touch**:
- `src/ui/cody/agents.ts` (MODIFIED — capabilities array, add tool mapping)

**Behavior**:
- Extend `AgentConfig.capabilities` from `string[]` to:
  ```typescript
  capabilities: Array<{
    label: string              // "Browse web URLs"
    toolName?: string          // "browseUrl" — maps to a specific tool
    mcpId?: string             // "github" — maps to an MCP
    alwaysAvailable?: boolean  // true for custom tools that are always present
  }>
  ```
- Map each capability to its backing tool or MCP:
  - `{ label: 'Browse repository files', mcpId: 'github' }`
  - `{ label: 'Browse web URLs', toolName: 'browseUrl', alwaysAvailable: true }`
  - `{ label: 'Analyze Figma designs', mcpId: 'figma' }`
  - `{ label: 'List and manage tasks', toolName: 'listCodyTasks', alwaysAvailable: true }`
- `getPublicAgentList()` already strips `systemPrompt` and `toolScope` — update it to include the enhanced capabilities

**Tests**:
- `tests/unit/cody/agents.test.ts`:
  - Test: `all capabilities reference valid tools or MCPs` — iterate capabilities, verify toolName or mcpId is valid
  - Test: `getPublicAgentList includes enhanced capabilities` — verify capabilities with labels returned

**Acceptance Criteria**:
- [ ] Each capability is mapped to its backing tool/MCP
- [ ] The mapping allows the UI to show green/red availability status
- [ ] `alwaysAvailable` capabilities are always green (custom tools are always present)

---

## Implementation Order

The features have dependencies:

```
Feature 2 (MCP Registry) ─── must come first, refactors tool infrastructure
    │
    ├── Feature 1 (Browser Tool) ─── uses registry to register the new MCP/tool
    │
    ├── Feature 6 (Capability Awareness) ─── uses registry health status
    │
    └── Feature 4 (Tool Call Visibility) ─── independent but benefits from registry health data
         │
         └── Feature 5 (Message Actions) ─── independent, can parallel with 4
              │
              └── Feature 3 (Sessions) ─── independent, largest feature, can start early
```

**Recommended execution order**:
1. **Feature 2** — MCP Registry (foundation for 1 and 6)
2. **Feature 1** — Browser Tool (immediate user value, uses registry)
3. **Feature 3** — Session Management (large, independent, high value)
4. **Feature 4** — Tool Call Visibility (enhances tool experience)
5. **Feature 5** — Message Actions (polish)
6. **Feature 6** — Agent Capability Awareness (leverages registry from step 1)

Each feature can be implemented, tested, and merged independently as a separate PR.

---

## Quality Gates

After ALL features:
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:int` passes (existing tests not broken)
- [ ] New tests pass: `pnpm vitest run tests/unit/cody/`
- [ ] Chat still works end-to-end: send message, receive streaming response, tools work
- [ ] Voice chat still works (no regression)
- [ ] Task mode persistence still works (GitHub save/load)
- [ ] Global mode persistence migrates cleanly from v1 to v2
- [ ] Mobile layout still works (Sheet-based chat panel)
