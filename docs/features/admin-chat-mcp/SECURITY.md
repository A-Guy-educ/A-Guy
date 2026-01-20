# Security Notes

- MCP is read-only in Stage 1.
- Admin auth is required for MCP tool use.
- Tenant scoping is injected server-side and cannot be overridden by tool args.
- All tool calls are audit-logged in `mcp-audit-logs`.
