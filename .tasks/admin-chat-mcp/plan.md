# Implementation Plan: Admin Chat with MCP-Powered System Capabilities

## Overview

This plan implements **Stage 1** of the PRD: Tenant-ready data model with read-only MCP tools for Courses, Chapters, Lessons, Exercises, and Media collections.

**Target Users**: This chat feature is **for admins only** in the Payload admin panel. Regular users (non-admins) cannot access MCP tools.

**Role Model**: Only `admin` and `user` roles exist. MCP tools are enabled when `req.user.role === 'admin'`.

**Key Architectural Decision**: The **Payload MCP plugin** is the MCP server. We do NOT build a custom MCP server endpoint or JSON-RPC handler.

---

## ✅ Phase 1: Tenant Infrastructure — COMPLETE

All tenant infrastructure is implemented:

- `src/server/payload/collections/Tenants.ts` — Tenants collection with beforeDelete protection
- `src/server/repos/tenant/get-default-tenant.ts` — Single source of truth for tenant resolution
- `src/server/payload/fields/tenant.ts` — Reusable tenant field with auto-assignment hook
- Tenant field added to: Courses, Chapters, Lessons, Exercises, Media, UserProgress, Prompts
- `src/server/payload/migrations/001-backfill-tenant.ts` — Migration script (`pnpm migrate:tenant`)
- `.env.example` — `DEFAULT_TENANT_SLUG`, `MCP_ENABLED`, `MCP_API_KEY`

---

## Phase 2: MCP Plugin Configuration & Discovery

### 2.1 Enable MCP Plugin

**Status**: Plugin installed but disabled

**Files to modify**:

- `src/server/payload/plugins/mcp/index.ts` — Currently exports `null`
- `src/server/payload/plugins/index.ts` — Has `const mcp = null`

**Tasks**:

1. Update `src/server/payload/plugins/mcp/index.ts` to configure the plugin:

   ```typescript
   import { mcpPlugin } from '@payloadcms/plugin-mcp'

   export const mcp = mcpPlugin({
     collections: {
       courses: {
         description: 'Educational courses with lessons and exercises',
         enabled: { find: true, create: false, update: false, delete: false },
       },
       chapters: {
         description: 'Course chapters that group lessons together',
         enabled: { find: true, create: false, update: false, delete: false },
       },
       lessons: {
         description: 'Individual lessons within chapters',
         enabled: { find: true, create: false, update: false, delete: false },
       },
       exercises: {
         description: 'Practice exercises associated with lessons',
         enabled: { find: true, create: false, update: false, delete: false },
       },
       media: {
         description: 'Media files (images, documents) used in content',
         enabled: { find: true, create: false, update: false, delete: false },
       },
     },
     mcp: {
       handlerOptions: {
         verboseLogs: process.env.NODE_ENV === 'development',
       },
       serverOptions: {
         serverInfo: { name: 'A-Guy MCP Server', version: '1.0.0' },
       },
     },
   })
   ```

2. Update `src/server/payload/plugins/index.ts`:
   - Remove `const mcp = null`
   - Import from `./mcp` conditionally based on `MCP_ENABLED` config variable
   - Use config entry system (not raw env var) for `MCP_ENABLED`

### 2.2 Run Tool Discovery

**Note**: Discovery can be run BEFORE or AFTER enabling the plugin. Both approaches work:

- **Before enabling**: Useful to preview what tools will be available
- **After enabling**: Standard approach to capture actual runtime behavior

**Script**: `scripts/admin-chat-mcp_discover-tools.ts` (exists)

**Tasks**:

1. Start dev server with `MCP_ENABLED=true` and `MCP_API_KEY` set (if running after enablement)
2. Run `pnpm mcp:discover-tools`
3. Create `docs/features/admin-chat-mcp/` directory
4. Verify `discovered-tools.json` is created with actual plugin output

**Output captures**:

- Tool names and descriptions
- Input schemas (argument structure)
- Filter path location (e.g., `args.where`)

### 2.3 Implement Tool Allowlist

**File**: `src/server/mcp/tool-allowlist.ts` (new)

Based on discovered tool structure, implement:

```typescript
// Hard blocklist - ALWAYS reject write operations
const WRITE_OPERATION_BLOCKLIST = new Set([
  'create',
  'update',
  'delete',
  'insert',
  'remove',
  'modify',
  'patch',
  'put',
  'post',
])

// Allowed collections
const ALLOWED_COLLECTIONS = new Set(['courses', 'chapters', 'lessons', 'exercises', 'media'])

function isAllowedTool(toolName: string): boolean {
  // 1. Hard blocklist check FIRST
  const lowerName = toolName.toLowerCase()
  for (const blocked of WRITE_OPERATION_BLOCKLIST) {
    if (lowerName.includes(blocked)) return false
  }

  // 2. Pattern match based on discovered structure
  // (Update pattern after discovery)
  return TOOL_PATTERN.test(toolName)
}
```

**Tasks**:

1. Create `src/server/mcp/tool-allowlist.ts`
2. Update pattern based on `discovered-tools.json`
3. Add unit tests: `tests/unit/mcp/tool-allowlist.test.ts`

### 2.4 Response Transformers

**File**: `src/server/mcp/transforms/index.ts` (new)

**Returned fields per collection** (metadata only, no large fields):

| Collection | Fields                                                               |
| ---------- | -------------------------------------------------------------------- |
| courses    | id, title, slug, status, updatedAt                                   |
| chapters   | id, title, slug, status, order, course.id, course.title, updatedAt   |
| lessons    | id, title, slug, status, order, chapter.id, chapter.title, updatedAt |
| exercises  | id, title, status, order, lesson.id, lesson.title, updatedAt         |
| media      | id, filename, mimeType, filesize, url, updatedAt                     |

**Tasks**:

1. Create `src/server/mcp/transforms/index.ts`
2. Add per-collection field allowlists
3. Add unit tests

---

## Phase 3: MCP Client & Chat Integration

### 3.1 MCP Client Service

**File**: `src/server/mcp/client/mcp-client.ts` (new)

```typescript
class MCPClient {
  private initialized = false
  private tools: Tool[] = []

  async initialize(): Promise<void>
  async listTools(): Promise<Tool[]>
  async callTool(name: string, args: unknown): Promise<ToolResult>
}
```

**Tasks**:

1. Create `src/server/mcp/client/mcp-client.ts`
2. Create `src/server/mcp/client/types.ts`
3. Add integration tests: `tests/int/mcp/client.int.spec.ts`

### 3.2 Tenant Enforcement Layer

**File**: `src/server/mcp/chat-integration.ts` (new)

**Enforcement points**:

1. **Before tool call**: Reject any `tenant` field in user-provided args (at any depth)
2. **Before tool call**: Inject tenant filter using discovered schema path
3. **After tool call**: Transform response (field allowlisting)

```typescript
const TENANT_INJECTION_CONFIG = {
  filterPath: 'where', // Update after discovery
  tenantFieldName: 'tenant',
  filterStyle: 'payload' as const,
}

async function executeToolCall(
  toolCall: ToolCall,
  tenantId: string,
  mcpClient: MCPClient,
): Promise<ToolResult>
```

**Error Handling**: Tool failures throw errors with full details exposed to the admin user for debugging.

**Tasks**:

1. Create `src/server/mcp/chat-integration.ts`
2. Create `src/server/mcp/validation/argument-validator.ts`
3. Add tests for tenant injection and rejection

### 3.3 Gemini Tool Calling Integration

**Files to modify**:

- `src/infra/ai/providers/gemini/gemini.provider.ts` — Add tools parameter
- `src/infra/ai/providers/gemini/gemini.mapper.ts` — Handle tool responses

**New file**: `src/infra/ai/providers/gemini/gemini-tools.ts`

```typescript
function mcpToolsToGeminiFunctionDeclarations(
  tools: Tool[],
  allowedToolNames: Set<string>,
): FunctionDeclaration[]
```

**Tasks**:

1. Create `src/infra/ai/providers/gemini/gemini-tools.ts`
2. Update Gemini provider to accept and use tools
3. Handle `functionCall` responses from Gemini

### 3.4 Chat Endpoint Integration

**File**: `src/server/payload/endpoints/agent/chat.ts` (modify)

**Key changes**:

1. Resolve tenant ONCE early in request
2. If admin role → enable MCP tools (user role gets regular chat without MCP)
3. Handle tool call loop until completion
4. On tool error → throw with full details exposed

```typescript
// Early in handler:
let tenantId: string | undefined
if (req.user.role === 'admin') {
  tenantId = await getDefaultTenantId(req.payload)
}

// Before Gemini call:
let tools: FunctionDeclaration[] | undefined
if (req.user.role === 'admin') {
  const mcpClient = getMCPClient()
  const allTools = await mcpClient.listTools()
  const allowedTools = discoverAllowedTools(allTools)
  tools = mcpToolsToGeminiFunctionDeclarations(allTools, allowedTools)
}

// Handle tool calls in loop
while (response.toolCalls?.length > 0) {
  // Execute each tool with tenant enforcement
  // On error: throw with full details exposed
  // Re-call Gemini with results
}
```

**Tasks**:

1. Modify chat endpoint for MCP integration
2. Update `src/infra/ai/services/exercise-chat-service.ts` to support tools
3. Add integration tests

---

## Phase 4: Audit Logging & Security

### 4.1 MCP Audit Log Collection

**File**: `src/server/payload/collections/MCPAuditLogs.ts` (exists, verify)

Fields:

- adminUserId, tenantId, toolName, args (sanitized)
- resultCount, success, timestamp, requestId, durationMs

Access: read=adminOnly, create=system only, update=never, delete=adminOnly

**Tasks**:

1. Verify MCPAuditLogs collection exists and is registered
2. If not, create and register in payload.config.ts
3. Run `pnpm generate:types`

### 4.2 Audit Logging Service

**File**: `src/server/mcp/audit/audit-service.ts` (new)

```typescript
async function logMCPCall(params: {
  adminUserId: string
  tenantId: string
  toolName: string
  args: unknown
  resultCount: number
  success: boolean
  durationMs: number
  requestId: string
}): Promise<void>
```

**Tasks**:

1. Create audit service
2. Integrate into `chat-integration.ts`
3. Add requestId generation

### 4.3 Argument Validation

**File**: `src/server/mcp/validation/argument-validator.ts` (new)

**Note**: Result limit is a **config entry parameter** (not hardcoded), defaulting to 10.

Validations:

- `limit <= config.MCP_MAX_RESULT_LIMIT`
- Filter fields in per-collection allowlist
- Sort fields in per-collection allowlist
- Reject `tenant` field anywhere in args

**Allowed filters per collection**:

| Collection | where fields           | sort fields             |
| ---------- | ---------------------- | ----------------------- |
| courses    | status, title          | title, updatedAt        |
| chapters   | status, title, course  | order, title, updatedAt |
| lessons    | status, title, chapter | order, title, updatedAt |
| exercises  | status, title, lesson  | order, title, updatedAt |
| media      | filename, mimeType     | filename, updatedAt     |

---

## Phase 5: Admin Chat UI

### 5.1 ChatInterface Admin Mode Support

**File**: `src/ui/web/chat/ChatInterface/index.tsx` (modify)

Add `adminMode` prop to enable admin chat without context:

```typescript
interface ChatInterfaceProps {
  // ... existing props
  adminMode?: boolean // NEW - enables admin capabilities without context
}
```

**Behavior when `adminMode=true`**:

- Bypasses context validation (no courseId/lessonId required)
- Uses context key `admin:chat` (shared across all admins)
- Shows admin-specific welcome message

**Tasks**:

1. Add `adminMode` prop to ChatInterface
2. Update `useNotebookChat` hook to support context-free admin mode
3. Add admin-specific translations

### 5.2 AdminChatView Component

**File**: `src/ui/admin/AdminChat/AdminChatView/index.tsx` (new)

Wrapper component that wraps ChatInterface with adminMode=true:

```typescript
export function AdminChatView() {
  return (
    <ChatInterface
      adminMode={true}
      translationNamespace="admin.chat"
      showQuickActions={true}
      showResetButton={true}
    />
  )
}
```

**Tasks**:

1. Create AdminChatView component
2. Add admin chat translations to `messages/en.json` and `messages/he.json`

### 5.3 Admin Chat Route

**Directory**: `src/app/(payload)/admin/chat/` (new)

**Files**:

- `page.tsx` — Admin chat page using AdminChatView
- `layout.tsx` — Admin layout wrapper (optional)

```typescript
// page.tsx
import { AdminChatView } from '@/ui/admin/AdminChat/AdminChatView'

export default function AdminChatPage() {
  return <AdminChatView />
}
```

**Tasks**:

1. Create `/admin/chat` route directory
2. Add page.tsx with AdminChatView

### 5.4 Sidebar Navigation Link

**File**: `src/ui/admin/AdminChat/SidebarLink/index.tsx` (new)

Custom sidebar link that appears in Payload admin navigation:

```typescript
import { SidebarLink } from '@payloadcms/ui'

export const AdminChatSidebarLink: React.FC = () => {
  return (
    <SidebarLink
      href='/admin/chat'
      icon={<ChatBubbleLeftRightIcon />}
      label='Admin Chat'
    />
  )
}
```

**Tasks**:

1. Create SidebarLink component
2. Register in `payload.config.ts` via `admin.components.afterNavLinks`

### 5.5 Dashboard Widget

**File**: `src/ui/admin/AdminChat/DashboardWidget/index.tsx` (new)

Quick-access widget for admins on the dashboard:

```typescript
export const AdminChatDashboardWidget: React.FC = () => {
  return (
    <Widget>
      <h3>Quick Admin Chat</h3>
      <p>Ask questions about your content using AI with MCP tools.</p>
      <Button as="a" href="/admin/chat">
        Open Admin Chat
      </Button>
    </Widget>
  )
}
```

**Tasks**:

1. Create DashboardWidget component
2. Register in `payload.config.ts` via `admin.components.beforeDashboard`

### 5.6 Payload Config Updates

**File**: `src/payload.config.ts` (modify)

Add admin components:

```typescript
export default buildConfig({
  admin: {
    components: {
      // Existing components
      beforeLogin: ['@/ui/admin/BeforeLogin'],
      beforeDashboard: [
        '@/ui/admin/BeforeDashboard',
        '@/ui/admin/AdminChat/DashboardWidget', // NEW
      ],
      afterNavLinks: ['@/ui/admin/AdminChat/SidebarLink'], // NEW
    },
    // ... rest of config
  },
  // ...
})
```

**Tasks**:

1. Add SidebarLink to `afterNavLinks`
2. Add DashboardWidget to `beforeDashboard`
3. Run `pnpm generate:importmap`

---

## Phase 6: Testing & Documentation

### 6.1 Unit Tests

- `tests/unit/mcp/tool-allowlist.test.ts`
- `tests/unit/mcp/chat-integration.test.ts`
- `tests/unit/mcp/validation/argument-validator.test.ts`
- `tests/unit/mcp/audit/audit-service.test.ts`

### 6.2 Integration Tests

- `tests/int/mcp/plugin.int.spec.ts`
- `tests/int/mcp/client.int.spec.ts`
- `tests/int/mcp/chat-integration.int.spec.ts`

### 6.3 E2E Tests

- `tests/e2e/admin-chat-mcp.spec.ts` — Backend MCP integration
- `tests/e2e/admin-chat-ui.spec.ts` — Admin chat UI components

### 6.4 Documentation

- `docs/features/admin-chat-mcp/README.md` — Overview and usage
- `docs/features/admin-chat-mcp/SECURITY.md` — Security considerations
- `docs/features/admin-chat-mcp/TOOLS.md` — Available MCP tools reference
- `docs/features/admin-chat-mcp/ADMIN_UI.md` — Admin chat UI guide (new)

---

## Implementation Order

### Step 1: Enable Plugin (Phase 2.1)

1. Configure `src/server/payload/plugins/mcp/index.ts`
2. Enable in `src/server/payload/plugins/index.ts` via config entry

### Step 2: Discovery (Phase 2.2) — BLOCKER

1. Start dev server with MCP enabled
2. Run `pnpm mcp:discover-tools`
3. Create `docs/features/admin-chat-mcp/discovered-tools.json`

**⚠️ Do not proceed until discovery is complete**

### Step 3: Allowlist & Transforms (Phase 2.3-2.4)

1. Implement tool allowlist based on discovered patterns
2. Implement response transformers

### Step 4: Client & Integration (Phase 3)

1. MCP client service
2. Tenant enforcement layer
3. Gemini tool calling
4. Chat endpoint integration

### Step 5: Audit & Security (Phase 4)

1. Audit logging
2. Argument validation

### Step 6: Admin Chat UI (Phase 5)

1. ChatInterface adminMode support
2. AdminChatView component
3. `/admin/chat` route
4. SidebarLink component
5. DashboardWidget component
6. Payload config updates

### Step 7: Testing & Docs (Phase 6)

1. Unit tests
2. Integration tests
3. E2E tests
4. Documentation

---

## File Summary

### New Files (Backend)

```
src/server/mcp/
├── client/
│   ├── mcp-client.ts
│   └── types.ts
├── tool-allowlist.ts
├── chat-integration.ts
├── transforms/
│   └── index.ts
├── validation/
│   └── argument-validator.ts
└── audit/
    └── audit-service.ts

src/infra/ai/providers/gemini/
└── gemini-tools.ts
```

### New Files (Admin UI)

```
src/ui/admin/AdminChat/
├── SidebarLink/
│   └── index.tsx
├── DashboardWidget/
│   └── index.tsx
└── AdminChatView/
    └── index.tsx

src/app/(payload)/admin/chat/
├── page.tsx
└── layout.tsx (optional)

docs/features/admin-chat-mcp/
├── README.md
├── SECURITY.md
├── TOOLS.md
├── discovered-tools.json
└── ADMIN_UI.md (new)
```

### Modified Files

```
src/server/payload/plugins/mcp/index.ts    # Enable plugin config
src/server/payload/plugins/index.ts        # Enable MCP via config entry
src/server/payload/endpoints/agent/chat.ts # MCP tool integration
src/infra/ai/providers/gemini/gemini.provider.ts  # Tool calling
src/infra/ai/services/exercise-chat-service.ts    # Tool support
src/ui/web/chat/ChatInterface/index.tsx    # Add adminMode prop
src/ui/web/chat/hooks/useNotebookChat.ts   # Support context-free admin mode
src/payload.config.ts                      # Register admin components
messages/en.json                           # Admin chat translations
messages/he.json                           # Admin chat translations (Hebrew)
```

### Existing Files (Already Implemented)

```
src/server/payload/collections/Tenants.ts
src/server/payload/collections/MCPAuditLogs.ts
src/server/repos/tenant/get-default-tenant.ts
src/server/payload/fields/tenant.ts
src/server/payload/migrations/001-backfill-tenant.ts
scripts/admin-chat-mcp_discover-tools.ts
```

---

## Acceptance Criteria

| Criteria                                               | Implementation                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Admin can ask "Show me the last 5 unpublished lessons" | Chat endpoint → MCP tools → tenant-scoped query → transformed response |
| Chat performs MCP read call scoped to Tenant           | Tenant resolved once per request, injected in chat-integration.ts      |
| Tenant cannot be overridden by model                   | Reject any `tenant` in args before processing                          |
| Unauthorized actions blocked and logged                | Tool allowlist + argument validation + audit logging                   |
| Only read operations possible                          | Plugin configured with find=true, create/update/delete=false           |
| Results capped at configurable limit                   | Argument validator enforces `limit <= config.MCP_MAX_RESULT_LIMIT`     |
| Error details exposed to admin                         | Tool failures throw with full error details                            |
| MCP tools only for admins                              | Check `req.user.role === 'admin'` before enabling tools                |
| No rate limiting                                       | MCP tool calls have no rate limits                                     |
| Admin Chat UI accessible via `/admin/chat`             | New route with AdminChatView component                                 |
| Sidebar link to Admin Chat                             | SidebarLink component in `afterNavLinks`                               |
| Dashboard quick-access widget                          | DashboardWidget component in `beforeDashboard`                         |
| Admin chat uses shared context key `admin:chat`        | ChatInterface with adminMode=true uses shared admin conversation       |
