# Bug: MCP Client fetch has no timeout — can hang serverless functions indefinitely

## Bug Description

`MCPClient.request()` in `src/server/repos/mcp/client/mcp-client.ts` (lines 57-71) calls `fetch()` with no `signal`, no `AbortController`, and no timeout. Every call to the MCP server can hang indefinitely if the MCP server is slow or unresponsive.

```typescript
const response = await fetch(endpoint.toString(), {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  // No AbortSignal, no timeout
})
```

Additionally, every `callTool` and `listTools` call first runs `initialize()`, meaning each MCP operation makes TWO sequential unbounded HTTP requests.

## Impact

A single slow MCP server can cause all admin chat requests using MCP tools to hang until the serverless function times out, affecting all admin users. This is a denial-of-service condition with cost implications on serverless platforms.

## Suggested Fix

Add an `AbortController` with a timeout (e.g., 15-30 seconds):

```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30_000)
try {
  const response = await fetch(endpoint.toString(), {
    signal: controller.signal,
    ...rest
  })
} finally {
  clearTimeout(timeoutId)
}
```