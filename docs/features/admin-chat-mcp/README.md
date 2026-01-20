# Admin Chat MCP (Stage 1)

This feature adds read-only MCP tooling to the existing admin chat backend.

## Run Tool Discovery

1. Ensure MCP is enabled:
   - `MCP_ENABLED=true`
   - `DEFAULT_TENANT_SLUG` set
2. Create an MCP API key in the admin UI (`payload-mcp-api-keys`) and export it:
   - `MCP_API_KEY=...`
3. Run discovery:
   - `pnpm mcp:discover-tools`

Discovery output is written to:
`docs/features/admin-chat-mcp/discovered-tools.json`
