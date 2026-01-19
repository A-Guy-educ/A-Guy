# Implementation Plan: Admin Chat with MCP-Powered System Capabilities

## Overview

This plan implements **Stage 1** of the PRD: Tenant-ready data model with read-only MCP tools for Courses, Chapters, Lessons, Exercises, and Media collections.

**Hard Constraint**: No changes to existing admin chat UI/flow. MCP is added as an optional capability layer to the backend only.

**Key Architectural Decision**: The **Payload MCP plugin** is the MCP server. We do NOT build a custom MCP server endpoint or JSON-RPC handler.

---

## Phase 1: Tenant Infrastructure

### 1.1 Create Tenants Collection

**File**: `src/collections/Tenants.ts`

```typescript
// Fields (minimal per spec):
// - name (text, required)
// - slug (text, required, unique, indexed)
// - status (select: active | archived, default: active)
// - createdAt, updatedAt (auto)

// Access Control:
// - read: adminOnly
// - create: adminOnly
// - update: adminOnly
// - delete: adminOnly (with protection for default tenant via slug check)

// NOTE: No isDefault field. Default tenant is resolved via DEFAULT_TENANT_SLUG env var.
```

**Tasks**:

1. Create `src/collections/Tenants.ts` with fields above
2. Add `beforeDelete` hook:
   - If `DEFAULT_TENANT_SLUG` env is missing → DENY delete (fail-safe)
   - If `doc.slug === process.env.DEFAULT_TENANT_SLUG` → DENY delete
3. Register in `src/payload.config.ts` collections array
4. Run `pnpm generate:types`

### 1.2 Create Tenant Resolver (Single Source of Truth)

**File**: `src/lib/tenant/get-default-tenant.ts`

```typescript
// AUTHORITATIVE tenant resolution
//
// Resolution logic:
// 1. Read DEFAULT_TENANT_SLUG from environment
// 2. If missing → THROW immediately (fail-fast, no silent fallback)
// 3. Query tenants collection: findOne({ slug: DEFAULT_TENANT_SLUG })
// 4. If not found → THROW (fail-fast)
// 5. Return tenantId
//
// This is the ONLY place tenant resolution happens.
// All other code imports and uses this resolver.

export function getDefaultTenantSlug(): string {
  const slug = process.env.DEFAULT_TENANT_SLUG
  if (!slug) {
    throw new Error('DEFAULT_TENANT_SLUG environment variable is required')
  }
  return slug
}

export async function getDefaultTenantId(payload: Payload): Promise<string> {
  const slug = getDefaultTenantSlug() // Throws if missing
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (!result.docs[0]) {
    throw new Error(`Default tenant with slug "${slug}" not found`)
  }
  return result.docs[0].id
}
```

**Caching Strategy**: NO global caching. Resolve once per chat request (see Phase 3.3).

**Tasks**:

1. Create `src/lib/tenant/get-default-tenant.ts` as the single source of truth
2. Add `DEFAULT_TENANT_SLUG` to `.env.example`
3. Add startup validation in `src/payload.config.ts`:
   - If `MCP_ENABLED=true` AND `DEFAULT_TENANT_SLUG` is missing → `throw new Error()` (fail-fast)
   - This prevents app startup with invalid configuration

### 1.3 Create Tenant Field Utility

**File**: `src/fields/tenant.ts`

```typescript
// Reusable tenant relationship field:
// - relationship to 'tenants'
// - required: true
// - admin: { position: 'sidebar' }
// - hooks.beforeValidate: auto-assign default tenant using getDefaultTenantId()
//
// NOTE: This field does NOT resolve tenant itself.
// It calls getDefaultTenantId() from src/lib/tenant/get-default-tenant.ts
```

**Tasks**:

1. Create `src/fields/tenant.ts` with shared field definition
2. Hook calls `getDefaultTenantId()` - does NOT duplicate resolution logic

### 1.4 Add Tenant Field to Content Collections

**Collections to modify**:

- `src/collections/Courses.ts`
- `src/collections/Chapters.ts`
- `src/collections/Lessons.ts`
- `src/collections/Exercises/index.ts`
- `src/collections/Media/index.ts`
- `src/collections/UserProgress.ts`

**Tasks** (per collection):

1. Import tenant field from `src/fields/tenant.ts`
2. Add tenant field to fields array
3. Add index on tenant field for query performance

### 1.5 Data Migration Script

**File**: `src/migrations/001-backfill-tenant.ts`

**Tasks**:

1. Create migration script that:
   - Validates `DEFAULT_TENANT_SLUG` env exists (fail-fast)
   - Creates default tenant (slug from `DEFAULT_TENANT_SLUG` env) if not exists
   - Backfills all existing Courses, Chapters, Lessons, Exercises, Media, UserProgress with default tenant ID
2. Create `pnpm migrate:tenant` script in package.json
3. Document rollback procedure

---

## Phase 2: MCP Server (Payload MCP Plugin)

### 2.1 Install and Configure Payload MCP Plugin

**File**: `src/plugins/mcp/index.ts`

The **Payload MCP plugin is the MCP server**. We configure it using its **documented configuration surface**.

**Tasks**:

1. Install the official Payload MCP plugin: `pnpm add @payloadcms/plugin-mcp`
2. Review plugin documentation for actual supported configuration options
3. Create MCP plugin configuration using **only documented APIs**:

   ```typescript
   import { mcpPlugin } from '@payloadcms/plugin-mcp'

   export const mcp = mcpPlugin({
     // Configure using ONLY plugin-documented options
     // Example (actual options depend on plugin docs):
     collections: ['courses', 'chapters', 'lessons', 'exercises', 'media'],
     // ... other plugin-supported options
   })
   ```

4. Register plugin in `src/plugins/index.ts`

**What the plugin provides (we do NOT implement)**:

- HTTP transport / MCP server endpoint
- MCP protocol handling (initialize, tools/list, tools/call)
- JSON-RPC message processing
- Tool definitions and naming

**What we implement (in the admin chat backend, NOT the plugin)**:

- Tool allowlist based on discovered plugin tool names
- Tenant injection before/after tool calls
- Response transformation (field allowlisting)
- Argument validation
- Audit logging

### 2.2 Tool Naming & Mapping Strategy

**Problem**: The plugin will expose tools with its own naming convention. We do NOT control tool names.

**Strategy**: Metadata-based allowlisting with regex fallback and hard defensive guards.

**Step 1: Mandatory Discovery Phase (Pre-Implementation)**

Before writing any allowlist code, run the plugin and capture actual tool definitions:

```typescript
// Discovery script (run once during implementation)
async function discoverPluginTools(): Promise<void> {
  const tools = await mcpClient.listTools()

  // Capture and document:
  for (const tool of tools) {
    console.log(
      JSON.stringify(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          // Capture any metadata the plugin provides
        },
        null,
        2,
      ),
    )
  }
}
```

**Output**: Create `docs/features/admin-chat-mcp/discovered-tools.json` with actual plugin output.

**Step 2: Allowlist Strategy Selection**

**Option A (Preferred) — Metadata-driven allowlist**:

If plugin provides structured metadata (e.g., `tool.metadata.collection`, `tool.metadata.operation`):

```typescript
function isAllowedTool(tool: Tool): boolean {
  const meta = tool.metadata
  if (!meta) return false

  const ALLOWED_COLLECTIONS = new Set(['courses', 'chapters', 'lessons', 'exercises', 'media'])
  const ALLOWED_OPERATIONS = new Set(['find', 'findByID', 'read', 'list']) // read-only

  return ALLOWED_COLLECTIONS.has(meta.collection) && ALLOWED_OPERATIONS.has(meta.operation)
}
```

**Option B — Regex-based with hard defensive tests**:

If plugin does NOT provide structured metadata, use regex with explicit guards:

```typescript
// IMPORTANT: These patterns MUST be validated against actual plugin output
// Pattern is determined AFTER discovery, not assumed

const TOOL_PATTERN_CONFIG = {
  // Pattern discovered from plugin (placeholder - replace with actual)
  pattern: /^payload_(find|findByID|list|read)_(courses|chapters|lessons|exercises|media)$/,

  // Hard blocklist - ALWAYS reject these regardless of pattern match
  blocklist: new Set([
    'create',
    'update',
    'delete',
    'insert',
    'remove',
    'modify',
    'patch',
    'put',
    'post',
  ]),
}

function isAllowedTool(toolName: string): boolean {
  // Hard blocklist check FIRST
  for (const blocked of TOOL_PATTERN_CONFIG.blocklist) {
    if (toolName.toLowerCase().includes(blocked)) {
      return false
    }
  }

  // Pattern match
  return TOOL_PATTERN_CONFIG.pattern.test(toolName)
}
```

**Required Tests** (must fail if unknown patterns appear):

```typescript
// tests/unit/mcp/tool-allowlist.test.ts

it('fails fast on unknown tool name patterns', () => {
  const unknownTool = 'some_unexpected_plugin_tool_format'

  // If a tool doesn't match our expected pattern AND isn't explicitly allowed,
  // it should be rejected and logged as a warning
  expect(isAllowedTool(unknownTool)).toBe(false)
  expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown tool pattern'), {
    toolName: unknownTool,
  })
})

it('always rejects write operations regardless of pattern', () => {
  const writeOps = [
    'payload_create_courses',
    'payload_update_lessons',
    'payload_delete_media',
    'some_tool_with_insert_anywhere',
    'PAYLOAD_DELETE_COURSES', // case variations
  ]

  writeOps.forEach((tool) => {
    expect(isAllowedTool(tool)).toBe(false)
  })
})
```

**Tasks**:

1. **BLOCKER**: Run discovery script and capture actual plugin tool definitions
2. Create `docs/features/admin-chat-mcp/discovered-tools.json` with plugin output
3. Determine if plugin provides metadata (prefer Option A) or requires regex (Option B)
4. Create `src/lib/mcp/tool-allowlist.ts` based on discovered structure
5. Add hard defensive tests that fail on unknown patterns
6. Add hard blocklist for write operations (case-insensitive)

### 2.3 Tenant Enforcement Layer

**Problem**: The plugin may NOT support server-side tenant injection.

**Solution**: Enforce tenant scoping in the **admin chat backend**, not in the plugin.

**Step 1: Mandatory Argument Schema Discovery (Pre-Implementation BLOCKER)**

Before implementing `injectTenantFilter()`, we MUST capture actual plugin argument schemas:

```typescript
// Discovery script (run once during implementation)
async function discoverToolArgumentSchemas(): Promise<void> {
  const tools = await mcpClient.listTools()

  for (const tool of tools) {
    console.log(
      JSON.stringify(
        {
          toolName: tool.name,
          inputSchema: tool.inputSchema,
          // Look specifically for:
          // - Where is the 'where' clause? (e.g., args.where, args.filter, args.query)
          // - What is the structure? (e.g., { field: { equals: value } })
          // - Is there a 'tenant' field already? (we need to know to reject/override it)
        },
        null,
        2,
      ),
    )
  }
}
```

**Output**: Update `docs/features/admin-chat-mcp/discovered-tools.json` to include:

- Exact path where filters live (e.g., `args.where`, `args.filter`)
- Structure of filter conditions (Payload-style vs other)
- Any existing tenant-related fields

**Step 2: Document Discovered Argument Structure**

After discovery, document the actual structure in the plan:

```typescript
// PLACEHOLDER - Replace with actual discovered structure
// Example if plugin uses Payload-style arguments:
interface DiscoveredArgumentStructure {
  // Discovered: filters are at args.where
  where?: {
    [field: string]: {
      equals?: unknown
      in?: unknown[]
      // ... other operators
    }
  }
  limit?: number
  sort?: string
  // ...
}
```

**Step 3: Implement Tenant Injection Based on Discovered Schema**

**Enforcement points** (in `src/lib/mcp/chat-integration.ts`):

1. **Before tool call**: Reject any tenant field in user-provided args
2. **Before tool call**: Inject tenant filter into discovered filter path
3. **After tool call**: Transform response (field allowlisting)

```typescript
// In chat-integration.ts:

// Configured AFTER discovery - these are placeholders
const TENANT_INJECTION_CONFIG = {
  // Path where filters live (discovered from plugin)
  filterPath: 'where', // e.g., 'where', 'filter', 'query.filter'

  // Tenant field name in the filter structure
  tenantFieldName: 'tenant',

  // Filter structure style (discovered from plugin)
  filterStyle: 'payload' as const, // or 'mongodb', 'custom', etc.
}

async function executeToolCall(
  toolCall: ToolCall,
  tenantId: string,  // Resolved once per request, passed in
  mcpClient: MCPClient
): Promise<ToolResult> {
  // 1. Validate tool is in allowlist
  if (!ALLOWED_TOOLS.has(toolCall.name)) {
    throw new SecurityError(`Tool ${toolCall.name} not allowed`)
  }

  // 2. Validate and sanitize args
  const sanitizedArgs = validateAndSanitizeArgs(toolCall.name, toolCall.args)

  // 3. Reject if tenant in args (at any depth)
  if (containsTenantField(sanitizedArgs, TENANT_INJECTION_CONFIG.tenantFieldName)) {
    throw new SecurityError('Tenant field not allowed in tool arguments')
  }

  // 4. Inject tenant filter using discovered schema structure
  const argsWithTenant = injectTenantFilter(
    sanitizedArgs,
    tenantId,
    TENANT_INJECTION_CONFIG
  )

  // 5. Execute via MCP client
  const rawResult = await mcpClient.callTool(toolCall.name, argsWithTenant)

  // 6. Transform response (field allowlisting)
  const transformedResult = transformResponse(toolCall.name, rawResult)

  // 7. Audit log (async, non-blocking)
  logMCPCall({ ... }).catch(console.error)

  return transformedResult
}

// Injection function based on discovered structure
function injectTenantFilter(
  args: Record<string, unknown>,
  tenantId: string,
  config: typeof TENANT_INJECTION_CONFIG
): Record<string, unknown> {
  const result = structuredClone(args)

  // Get or create the filter object at the discovered path
  const filterPath = config.filterPath.split('.')
  let current: Record<string, unknown> = result

  for (let i = 0; i < filterPath.length - 1; i++) {
    if (!current[filterPath[i]]) {
      current[filterPath[i]] = {}
    }
    current = current[filterPath[i]] as Record<string, unknown>
  }

  const finalKey = filterPath[filterPath.length - 1]
  if (!current[finalKey]) {
    current[finalKey] = {}
  }

  // Inject tenant using discovered filter style
  const filter = current[finalKey] as Record<string, unknown>

  if (config.filterStyle === 'payload') {
    // Payload style: { tenant: { equals: tenantId } }
    filter[config.tenantFieldName] = { equals: tenantId }
  } else {
    // MongoDB style or other: { tenant: tenantId }
    filter[config.tenantFieldName] = tenantId
  }

  return result
}
```

**Tasks**:

1. **BLOCKER**: Run discovery script and capture actual argument schemas
2. Document discovered filter path, structure, and style
3. Update `TENANT_INJECTION_CONFIG` with discovered values
4. Create `src/lib/mcp/chat-integration.ts` with tenant enforcement
5. Create `src/lib/mcp/validation/argument-validator.ts`
6. Create `src/lib/mcp/transforms/index.ts`
7. Add tests for tenant injection using actual discovered schema
8. Add tests for tenant override rejection at any depth

### 2.4 Response Transformers (Field Allowlisting)

**Directory**: `src/lib/mcp/transforms/`

Applied in the **admin chat backend** after receiving plugin response.

**Returned fields per collection** (explicit allowlist - metadata only):

| Collection | Fields                                                               |
| ---------- | -------------------------------------------------------------------- |
| courses    | id, title, slug, status, updatedAt                                   |
| chapters   | id, title, slug, status, order, course.id, course.title, updatedAt   |
| lessons    | id, title, slug, status, order, chapter.id, chapter.title, updatedAt |
| exercises  | id, title, status, order, lesson.id, lesson.title, updatedAt         |
| media      | id, filename, mimeType, filesize, url, updatedAt                     |

**Note**: No large/verbose fields (descriptions, rich text, etc.) in Stage 1.

**Tasks**:

1. Create `src/lib/mcp/transforms/index.ts` - transformer registry
2. Create per-collection transformers that extract only allowlisted fields
3. Add tests for transformation

---

## Phase 3: MCP Client (Admin Chat Backend)

### 3.1 MCP Client Service

**File**: `src/lib/mcp/client/mcp-client.ts`

```typescript
// Responsibilities:
// - Connect to Payload MCP plugin endpoint (internal HTTP)
// - Fetch available tools on initialization
// - Execute tool calls
// - Handle errors gracefully

class MCPClient {
  private initialized = false
  private tools: Tool[] = []

  async initialize(): Promise<void> {
    // Fetch tools from plugin
    this.tools = await this.fetchToolsFromPlugin()
    this.initialized = true
  }

  async listTools(): Promise<Tool[]> {
    if (!this.initialized) await this.initialize()
    return this.tools
  }

  async callTool(name: string, args: unknown): Promise<ToolResult> {
    // Raw call to plugin - no filtering here
    // Filtering happens in chat-integration.ts
  }
}
```

**Note**: Tool allowlisting is NOT in the client. It's in `chat-integration.ts`.

**Tasks**:

1. Create `src/lib/mcp/client/mcp-client.ts`
2. Create `src/lib/mcp/client/types.ts` - MCP protocol types
3. Create singleton instance with lazy initialization
4. Add integration tests

### 3.2 Gemini Tool/Function Calling Integration

**File**: `src/lib/ai/providers/gemini/gemini-tools.ts`

```typescript
// Convert MCP tools to Gemini function declarations
// Tool names come from plugin - we don't control them

function mcpToolsToGeminiFunctionDeclarations(
  tools: Tool[],
  allowedToolNames: Set<string>,
): FunctionDeclaration[] {
  return tools
    .filter((tool) => allowedToolNames.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: convertJsonSchemaToGemini(tool.inputSchema),
    }))
}
```

**Tasks**:

1. Create `src/lib/ai/providers/gemini/gemini-tools.ts`
2. Update `src/lib/ai/providers/gemini/gemini.provider.ts`:
   - Add optional `tools` parameter to `generateChatCompletion`
   - Handle `functionCall` responses from Gemini
   - Return tool call requests to caller
3. Update `src/lib/ai/providers/gemini/gemini.mapper.ts` for tool responses

### 3.3 Tool Execution Flow in Chat Endpoint

**File**: `src/endpoints/agent/chat.ts` (modify existing)

**Key change**: Resolve tenant ONCE at the start of the request, pass it down.

```typescript
// EARLY in the request handler:

// Step X: Resolve tenant ONCE for this request
let tenantId: string | undefined
const isAdminContext = contextRef.startsWith('tenants:')
if (isAdminContext && req.user.role === 'admin') {
  tenantId = await getDefaultTenantId(req.payload) // Throws if missing
}

// ... later in the flow ...

// Step 12.5: Check if admin context (tenant-scoped conversation)
// Step 12.6: If admin context AND user is admin, enable MCP tools
let tools: FunctionDeclaration[] | undefined
if (isAdminContext && req.user.role === 'admin') {
  const mcpClient = getMCPClient()
  const allTools = await mcpClient.listTools()
  const allowedTools = discoverAllowedTools(allTools) // Returns Set<string>
  tools = mcpToolsToGeminiFunctionDeclarations(allTools, allowedTools)
}

// Step 13: Call Gemini (with tools if admin)
const response = await exerciseChatService.chat(composed, { tools })

// Step 13.5: Handle tool calls (loop until no more tool calls)
while (response.toolCalls && response.toolCalls.length > 0) {
  for (const toolCall of response.toolCalls) {
    // Execute with tenant enforcement
    // tenantId is passed down - resolved once at request start
    const result = await executeToolCall(toolCall, tenantId!, mcpClient)
    // Append result to conversation
    // Re-call Gemini with tool results
  }
}
```

**Tasks**:

1. Modify `src/endpoints/agent/chat.ts` to:
   - Resolve tenant ONCE early in request
   - Pass tenantId to all tool execution calls
2. Create `src/lib/mcp/chat-integration.ts` - orchestrates tool execution with tenant
3. Update `src/lib/ai/services/exercise-chat-service.ts` to support tools
4. Add tests for tool execution flow

---

## Phase 4: Audit Logging

### 4.1 MCP Audit Log Collection

**File**: `src/collections/MCPAuditLogs.ts`

```typescript
// Fields (per spec):
// - adminUserId (relationship to users)
// - tenantId (relationship to tenants)
// - toolName (text) - actual plugin tool name
// - args (json) - sanitized arguments
// - resultCount (number)
// - success (boolean)
// - timestamp (date)
// - requestId (text) - correlation ID
// - durationMs (number)

// Access Control:
// - read: adminOnly
// - create: system only (via overrideAccess)
// - update: never (append-only)
// - delete: adminOnly (with retention policy)
```

**Tasks**:

1. Create `src/collections/MCPAuditLogs.ts`
2. Register in `src/payload.config.ts`
3. Run `pnpm generate:types`

### 4.2 Audit Logging Service

**File**: `src/lib/mcp/audit/audit-service.ts`

```typescript
// Log every MCP tool call (async, non-blocking):
async function logMCPCall(params: {
  adminUserId: string
  tenantId: string
  toolName: string // Actual plugin tool name
  args: unknown // sanitized
  resultCount: number
  success: boolean
  durationMs: number
  requestId: string
}): Promise<void>
```

**Tasks**:

1. Create `src/lib/mcp/audit/audit-service.ts`
2. Integrate into `chat-integration.ts` (called after every tool execution)
3. Add requestId generation and propagation

---

## Phase 5: Security Hardening

### 5.1 Triple-Lock Read-Only Enforcement

**Enforcement Points**:

1. **Plugin Configuration Level**:
   - Configure plugin with minimal permissions (if supported)
   - Only expose allowed collections

2. **Tool Allowlist Level** (`src/lib/mcp/tool-allowlist.ts`):
   - Discover tools from plugin
   - Filter to only read operations on allowed collections
   - Reject any tool not in discovered allowlist

3. **Argument Validation Level** (`src/lib/mcp/validation/argument-validator.ts`):
   - Validate args match expected schema per tool
   - Enforce limit <= 10
   - Reject any write-like arguments

**Tasks**:

1. Add explicit deny logging for blocked operations
2. Create security test suite validating all three locks
3. Document bypass prevention in code comments

### 5.2 Tenant Security (Cannot Be Overridden)

**Enforcement in `src/lib/mcp/chat-integration.ts`**:

```typescript
// BEFORE processing any tool call:
// 1. Check if args contain 'tenant' key at any depth
// 2. If found, REJECT request with security error and log
// 3. Inject tenant filter using tenantId passed from request handler

function containsTenantField(obj: unknown): boolean {
  // Recursively check for 'tenant' key
  if (typeof obj !== 'object' || obj === null) return false
  if ('tenant' in obj) return true
  return Object.values(obj).some((v) => containsTenantField(v))
}

function injectTenantFilter(args: unknown, tenantId: string): unknown {
  // Add tenant filter to where clause
  // Implementation depends on plugin's argument structure
}
```

**Tasks**:

1. Implement tenant field rejection in `chat-integration.ts`
2. Add tests for tenant override attempts (should all fail)
3. Log all tenant override attempts as security events

### 5.3 Argument Validation

**File**: `src/lib/mcp/validation/argument-validator.ts`

```typescript
// Validate all tool arguments:
// - Limit must be <= 10
// - Filter fields must be in per-collection allowlist
// - Sort fields must be in per-collection allowlist
// - REJECT any 'tenant' field in args (security)
// - Sanitize string values (no injection)
```

**Allowed filters per collection** (strict allowlist):

| Collection | Allowed `where` fields | Allowed `sort` fields   |
| ---------- | ---------------------- | ----------------------- |
| courses    | status, title          | title, updatedAt        |
| chapters   | status, title, course  | order, title, updatedAt |
| lessons    | status, title, chapter | order, title, updatedAt |
| exercises  | status, title, lesson  | order, title, updatedAt |
| media      | filename, mimeType     | filename, updatedAt     |

**Tasks**:

1. Create `src/lib/mcp/validation/argument-validator.ts`
2. Create per-collection filter/sort allowlists
3. Add validation tests with malicious inputs

---

## Phase 6: Testing

### 6.1 Unit Tests

**Files**:

- `tests/unit/mcp/tool-allowlist.test.ts`
- `tests/unit/mcp/chat-integration.test.ts`
- `tests/unit/mcp/validation/argument-validator.test.ts`
- `tests/unit/mcp/audit/audit-service.test.ts`
- `tests/unit/tenant/get-default-tenant.test.ts`

**Test Cases**:

- Tool discovery and allowlist filtering
- Tenant injection (always present)
- Tenant override rejection (security)
- Argument validation (valid/invalid)
- Response transformation (only allowlisted fields)
- Error handling
- Fail-fast on missing DEFAULT_TENANT_SLUG

### 6.2 Integration Tests

**Files**:

- `tests/int/mcp/plugin.int.spec.ts`
- `tests/int/mcp/client.int.spec.ts`
- `tests/int/mcp/chat-integration.int.spec.ts`

**Test Cases**:

- End-to-end MCP plugin request/response
- Admin chat with tool calling
- Audit log creation
- Authentication/authorization flows
- Tenant isolation verification

### 6.3 E2E Tests

**Files**:

- `tests/e2e/admin-chat-mcp.spec.ts`

**Test Cases**:

- Admin asks "Show me the last 5 unpublished lessons" → receives formatted list
- Non-admin user cannot trigger MCP tools
- Invalid tool calls are blocked and logged
- Tenant override attempts are blocked

---

## Phase 7: Configuration & Documentation

### 7.1 Environment Configuration

**File**: `.env.example` additions

```bash
# Tenant Configuration (SINGLE source of truth)
# REQUIRED - application will fail to start if missing
DEFAULT_TENANT_SLUG=default

# MCP Configuration
MCP_ENABLED=true  # Feature flag to enable/disable MCP tools in chat
```

**Startup behavior** (FAIL-FAST - no silent degradation):

- If `DEFAULT_TENANT_SLUG` is missing AND `MCP_ENABLED=true` → Application FAILS TO START with clear error
- If `MCP_ENABLED=false` → MCP tools not offered to Gemini, `DEFAULT_TENANT_SLUG` not required

**Rationale**: Silent degradation hides configuration errors. Fail-fast ensures problems are caught at deploy time, not runtime.

### 7.2 Documentation

**Files**:

- `docs/features/admin-chat-mcp/README.md` - Feature overview
- `docs/features/admin-chat-mcp/SECURITY.md` - Security model
- `docs/features/admin-chat-mcp/TOOLS.md` - Available tools (document actual plugin tool names)

---

## Implementation Order (Recommended)

### Week 1: Foundation

1. Phase 1.1: Create Tenants collection
2. Phase 1.2: Create tenant resolver (single source of truth)
3. Phase 1.3: Create tenant field utility
4. Phase 1.4: Add tenant field to collections
5. Phase 1.5: Data migration script

### Week 2: MCP Plugin & Discovery (CRITICAL - BLOCKERS)

6. Phase 2.1: Install and configure Payload MCP plugin
7. **BLOCKER**: Run tool discovery script, capture output
8. **BLOCKER**: Run argument schema discovery, capture output
9. Create `docs/features/admin-chat-mcp/discovered-tools.json` with actual plugin data
10. Determine allowlist strategy (metadata vs regex) based on discovery
11. Implement tool allowlist with hard defensive tests
12. Document `TENANT_INJECTION_CONFIG` with actual discovered values

### Week 3: MCP Client & Integration

13. Phase 2.3: Implement tenant enforcement with discovered schema
14. Phase 2.4: Response transformers
15. Phase 3.1: MCP client service
16. Phase 3.2: Gemini tool calling
17. Phase 3.3: Chat endpoint integration

### Week 4: Security & Polish

18. Phase 4: Audit logging
19. Phase 5: Security hardening
20. Phase 6: Testing
21. Phase 7: Configuration & docs

**⚠️ Gate Condition**: Steps 7-12 in Week 2 are BLOCKERS. Do not proceed to Week 3 until:

- Tool names are captured from actual plugin output
- Argument schemas are captured from actual plugin output
- Allowlist strategy is selected based on evidence (not assumptions)
- `TENANT_INJECTION_CONFIG` values are documented from discovery

---

## File Summary

### New Files (18)

```
src/collections/
├── Tenants.ts
└── MCPAuditLogs.ts

src/fields/
└── tenant.ts

src/lib/
├── tenant/
│   └── get-default-tenant.ts       # SINGLE SOURCE OF TRUTH for tenant resolution
└── mcp/
    ├── client/
    │   ├── mcp-client.ts
    │   └── types.ts
    ├── tool-allowlist.ts            # Discovers and filters plugin tools
    ├── chat-integration.ts          # Tenant injection + tool orchestration
    ├── transforms/
    │   └── index.ts                 # Field allowlisting per collection
    ├── validation/
    │   └── argument-validator.ts
    └── audit/
        └── audit-service.ts

src/lib/ai/providers/gemini/
└── gemini-tools.ts

src/plugins/mcp/
└── index.ts                         # Plugin configuration ONLY

src/migrations/
└── 001-backfill-tenant.ts

docs/features/admin-chat-mcp/
└── discovered-tools.json      # MANDATORY: Actual plugin tool definitions captured during discovery
```

### Modified Files (9)

```
src/payload.config.ts               # Add Tenants, MCPAuditLogs collections
src/plugins/index.ts                # Add MCP plugin
src/collections/Courses.ts          # Add tenant field
src/collections/Chapters.ts         # Add tenant field
src/collections/Lessons.ts          # Add tenant field
src/collections/Exercises/index.ts  # Add tenant field
src/collections/Media/index.ts      # Add tenant field
src/collections/UserProgress.ts     # Add tenant field
src/endpoints/agent/chat.ts         # MCP tool integration
src/lib/ai/providers/gemini/gemini.provider.ts  # Tool calling support
src/lib/ai/services/exercise-chat-service.ts    # Tool support
.env.example                        # DEFAULT_TENANT_SLUG, MCP_ENABLED
```

### Files NOT Created (Spec Compliance)

```
❌ src/endpoints/mcp/server.ts      # Plugin is the server
❌ src/app/api/mcp/route.ts         # Plugin handles transport
❌ Any JSON-RPC handling code        # Plugin handles protocol
❌ src/lib/mcp/handlers/*           # No custom plugin handlers
```

---

## Acceptance Criteria Validation

| Criteria                                               | Implementation                                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin can ask "Show me the last 5 unpublished lessons" | Chat endpoint detects admin context → discovers allowed tools from plugin → Gemini calls plugin tool → backend injects tenant, validates args → returns allowlisted fields |
| Chat performs MCP read call scoped to Tenant           | Tenant resolved once per request via `getDefaultTenantId()`, injected in `chat-integration.ts`                                                                             |
| Tenant cannot be overridden by model                   | `chat-integration.ts` rejects any `tenant` in args before processing                                                                                                       |
| Unauthorized action attempts are blocked and logged    | Tool allowlist + argument validation + audit logging                                                                                                                       |
| Only read operations possible                          | Tool allowlist filters to read-only plugin tools                                                                                                                           |
| Results capped at 10                                   | Argument validator enforces `limit <= 10`                                                                                                                                  |
| Missing DEFAULT_TENANT_SLUG fails fast                 | If `MCP_ENABLED=true` AND missing → startup fails; `getDefaultTenantSlug()` throws at runtime as secondary guard                                                           |

---

## Risks & Mitigations

| Risk                             | Mitigation                                                |
| -------------------------------- | --------------------------------------------------------- |
| Plugin exposes write operations  | Tool allowlist filters to read-only tools only            |
| Cross-tenant data leak           | Tenant injected in backend, rejected if in args           |
| Tool call without user awareness | Gemini function calls are explicit, results shown in chat |
| Audit log tampering              | Append-only collection, no update access                  |
| Tenant resolution inconsistency  | Single source of truth + resolve once per request         |
| Plugin API changes               | Tool names discovered at runtime, not hardcoded           |
| Missing env var                  | Fail-fast with clear error message                        |

---

## Exit Criteria for Stage 2

Before proceeding to write operations:

- [ ] Zero unexpected tool calls in production
- [ ] Stable latency (<500ms p95 for tool calls)
- [ ] Zero tenant override attempts succeeded
- [ ] Admin trust validated via feedback
- [ ] Security review completed
- [ ] Explicit decision to add write operations documented

---

## Acceptance Check (Plan Validity)

### Core Requirements

✅ No assumed plugin API (no fictional `toolHandler`)
✅ Tool names discovered from plugin, not hardcoded
✅ Allowlist based on real plugin tool names
✅ Tenant resolved once per chat request, passed down
✅ Tenant injected server-side (in backend), cannot be overridden
✅ Only read operations, capped at 10 results
✅ Payload MCP plugin is the only MCP server

### Critical Fixes Applied

✅ **DEFAULT_TENANT_SLUG Fail-Fast**: If `MCP_ENABLED=true` AND missing → startup fails (no silent degradation)
✅ **Tool Allowlist Strategy**: Metadata-based (Option A) or regex with hard defensive tests (Option B) - selected AFTER discovery
✅ **Tenant Injection Determinism**: `TENANT_INJECTION_CONFIG` populated from mandatory discovery step, not assumed
✅ **Discovery Blockers**: Tool names AND argument schemas captured from actual plugin before implementation
✅ **Hard Blocklist**: Write operations rejected via case-insensitive keyword blocklist regardless of pattern match
✅ **Unknown Pattern Warning**: Tools that don't match expected patterns are rejected AND logged as warnings
