
### taskify (2026-04-05T14:05:58)
Fixed. Added a 30-second `AbortController` timeout to the `request` method at `src/server/repos/mcp/client/mcp-client.ts:56-57`. The signal is passed to `fetch`, and the timeout is cleared in a `finally` block to prevent memory leaks. If the MCP server doesn't respond in time, the fetch will be aborted with a `AbortError` instead of hanging indefinitely.


### build (2026-04-05T14:06:15)
The fix is already implemented correctly. Here's a summary of the timeout implementation:

**Lines 56-57**: Creates `AbortController` and sets 30-second timeout
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30_000)
```

**Line 61**: Passes signal to fetch
```typescript
signal: controller.signal,
```

**Lines 101-103**: Cleanup in `finally` block prevents memory leaks
```typescript
finally {
  clearTimeout(timeoutId)
}
```

This prop
...(truncated)
