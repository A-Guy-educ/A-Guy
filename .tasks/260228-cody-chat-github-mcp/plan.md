# Plan: Integrate GitHub MCP Server into Cody Chat

## Summary

Enable the **already-existing** GitHub MCP integration in the Cody chat route. The code is fully written but disabled (commented out) at lines 348-356 of `route.ts` due to past "connection issues." Testing confirms the remote HTTP endpoint (`api.githubcopilot.com/mcp/`) works with the existing `GITHUB_TOKEN` (`gho_` OAuth token). This is a **fix** — uncomment, add error handling, and update the system prompt.

## Verified Facts

- `POST https://api.githubcopilot.com/mcp/` with `Authorization: Bearer $GITHUB_TOKEN` → **200 OK** ✅
- `tools/list` returns 30+ tools (get_file_contents, search_code, list_issues, etc.) ✅
- Requires `Mcp-Session-Id` header from `initialize` response for subsequent calls ✅
- `@ai-sdk/mcp@^1.0.0` already installed, `createMCPClient` already imported ✅
- Works on Vercel — pure HTTP, no Docker needed ✅

## Architecture (unchanged)

```
CodyChat.tsx → POST /api/cody/chat → route.ts
  ↓
  getMCPClient() → cached MCPClient (HTTP to api.githubcopilot.com/mcp/)
  ↓
  mcpClient.tools() → GitHub MCP tools
  ↓
  allTools = { ...mcpTools, ...customTools }
  ↓
  streamText({ tools: allTools }) → SSE response
```

---

### Step 1: Enable MCP client and update system prompt

**Time estimate**: 15 minutes

**Files to Touch**:
- `src/app/api/cody/chat/route.ts` (MODIFIED — lines 348-356, 266-293)

**Behavior**:

1. **Uncomment** the MCP tools block (lines 348-356), replacing the hardcoded `const mcpTools = {}` with:
   ```typescript
   let mcpTools = {}
   try {
     const mcp = await getMCPClient()
     mcpTools = await mcp.tools()
     logger.info({ requestId, toolCount: Object.keys(mcpTools).length }, 'GitHub MCP tools loaded')
   } catch (mcpError) {
     logger.warn({ err: mcpError, requestId }, 'GitHub MCP tools unavailable — using custom tools only')
   }
   ```

2. **Update the system prompt** (lines 266-293) to guide the AI on when to use MCP tools vs custom Cody tools:
   - Add: "Use GitHub MCP tools (get_file_contents, search_code, list_issues, list_pull_requests, etc.) for repository browsing and GitHub API operations"
   - Add: "Use custom Cody tools (listCodyTasks, getCodyTask, getPipelineStatus) for pipeline-specific queries"
   - Add: "If GitHub MCP tools are unavailable, tell the user and fall back to custom tools"

3. **Keep everything else unchanged** — `getMCPClient()`, `createMCPClient`, `customTools`, the merge logic — all already correct.

**Tests** (FAIL before, PASS after):

1. **Unit test**: `tests/unit/app/api/cody/chat/route-mcp.test.ts`
   - Mock `@ai-sdk/mcp` module's `createMCPClient`
   - Test: `POST /api/cody/chat merges MCP tools with custom tools`
     - Mock `createMCPClient` → client with `.tools()` returning `{ get_file_contents: mockTool }`
     - Mock `streamText` from `ai`
     - POST a message → verify `streamText` was called with tools containing both `get_file_contents` and `listCodyTasks`
   - Test: `POST /api/cody/chat works when MCP client fails`
     - Mock `createMCPClient` to reject
     - POST a message → verify response is 200 (not 500), only custom tools used
   - Test: `system prompt mentions GitHub MCP tools`
     - Import/extract SYSTEM_PROMPT
     - Verify contains 'get_file_contents' and 'listCodyTasks'

**Acceptance Criteria**:
- [ ] MCP tools block is uncommented and wrapped in try/catch
- [ ] Logger info on successful MCP tool load
- [ ] Logger warn on MCP failure (graceful degradation)
- [ ] System prompt guides AI on tool selection
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] Chat works when MCP is available (tools merged)
- [ ] Chat works when MCP is unavailable (custom tools only)

---

## Test Commands

```bash
pnpm vitest run tests/unit/app/api/cody/chat/
pnpm tsc --noEmit
pnpm lint
```

## Verification (manual)

```bash
# 1. Verify MCP endpoint is reachable
curl -s -X POST "https://api.githubcopilot.com/mcp/" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-11-05","clientInfo":{"name":"test","version":"1.0.0"},"capabilities":{}}}'
# Expected: 200 with serverInfo

# 2. GET /api/cody/chat should report MCP tools
# Expected: { toolsets: ['github-mcp', 'custom-cody'], toolCount: 35+ }

# 3. Chat: "what files are in src/app?" → should use get_file_contents MCP tool
# 4. Chat: "list my tasks" → should use listCodyTasks custom tool
```
