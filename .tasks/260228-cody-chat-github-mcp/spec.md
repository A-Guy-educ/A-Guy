# Integrate GitHub MCP Server into Cody Chat

## Goal
Enable the GitHub MCP tools in the `/cody chat` endpoint by connecting to GitHub's official MCP server via `@ai-sdk/mcp` stdio transport using Docker (`ghcr.io/github/github-mcp-server`).

## Context
- The chat route (`src/app/api/cody/chat/route.ts`) already has MCP client code but it's **disabled** (lines 348-356) because it pointed to `https://api.githubcopilot.com/mcp/` which had connection issues.
- `@ai-sdk/mcp@^1.0.0` is already installed and supports `StdioMCPTransport` via `@ai-sdk/mcp/mcp-stdio`.
- GitHub's official MCP server is a Go binary available at `ghcr.io/github/github-mcp-server` Docker image.
- The AI SDK's `createMCPClient` accepts either `MCPTransportConfig` (http/sse) or a raw `MCPTransport` instance (like `StdioMCPTransport`).

## Requirements

### R1: Replace HTTP transport with stdio transport
Replace the disabled Copilot HTTP MCP client with a `StdioMCPTransport` that spawns the GitHub MCP server Docker container (or binary) via stdio.

### R2: Tool allowlisting for security
Only expose a safe subset of GitHub MCP tools to the chat AI — specifically read-only tools relevant to the Cody dashboard (repos, issues, pull_requests, actions).

### R3: Graceful degradation
If the MCP server fails to start (Docker not available, token missing), the chat should still work with only the custom Cody tools. Log a warning, don't crash.

### R4: Lifecycle management
The MCP client/process should be cached (singleton) and properly cleaned up. Don't spawn a new Docker container per request.

### R5: Toolset configuration
Use `GITHUB_TOOLSETS` env var to restrict tools to: `repos,issues,pull_requests,actions,context`.

## Non-Goals
- No changes to the frontend CodyChat component
- No changes to the existing custom Cody tools
- No multi-tenant scoping (this is GitHub API, not Payload)

## Task Type: implement_feature
