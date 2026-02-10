## Summary

This PR enables MCP (Model Context Protocol) tool access for creating courses, chapters, and lessons, and enhances the Genkit adapter with proper tool handling for the AI agent.

## Changes

### MCP Auth & Tool Allowlist Updates

1. **src/server/payload/plugins/mcp/index.ts** - Updated `overrideAuth` to grant create permissions for courses, chapters, and lessons while maintaining read-only for exercises and media

2. **src/server/repos/mcp/tool-allowlist.ts** - Removed create operations from blocklist for `courses`, `chapters`, and `lessons` collections

3. **src/payload-types.ts** - Generated type updates reflecting new `create` permissions in `PayloadMcpApiKey`

### Genkit Adapter Enhancement

4. **src/infra/llm/genkit/adapters/unified-adapter.ts** - Major refactor to properly handle MCP tools:
   - Added `extractKeyParams()` and `buildToolDescription()` helpers for enhanced LLM guidance
   - Integrated Genkit `tool()` wrapper for proper tool definitions
   - Fixed message role handling (ensures first non-system message is 'user')
   - Added `toolChoice: 'auto'` and `maxTurns: 5` configuration

5. **src/server/payload/endpoints/agent/chat.ts** - Minor adjustments to support new tool handling

### Tests Updated

6. **tests/unit/server/payload/plugins/mcp-auth.test.ts** - Updated test expectations for new auth behavior
7. **tests/unit/server/repos/mcp/tool-allowlist.test.ts** - Updated tests to verify create operations now allowed

### Documentation

8. **docs/features/guest-chat/spec.md** - New specification document

## Files Changed

```
 src/infra/llm/genkit/adapters/unified-adapter.ts   | 76 ++++++++++++++++++++--
 src/payload-types.ts                               | 27 ++++++--
 src/server/payload/endpoints/agent/chat.ts         | 10 ++-
 src/server/payload/plugins/mcp/index.ts            | 18 ++---
 src/server/repos/mcp/tool-allowlist.ts             | 22 +++++--
 tests/unit/server/payload/plugins/mcp-auth.test.ts | 53 ++++++++++++---
 tests/unit/server/repos/mcp/tool-allowlist.test.ts | 28 ++++----
```

## Testing

Run tests to verify:

```bash
pnpm test -- --testPathPattern="mcp"
```

## Checklist

- [x] Code follows project conventions
- [x] Self-reviewed changes
- [x] Tests pass
- [x] Types generated
