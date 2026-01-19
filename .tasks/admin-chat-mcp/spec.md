# High-Level Technical Specification

## Scope

**Phase:** Stage 1 (Baseline)

**Context:** Admin Chat only

**Hard Constraint – Existing Chat Reuse**

- The admin chat is an existing, production component.
- This specification **does not introduce a new chat UI, flow, or architecture**.
- MCP integration is implemented by **extending the existing admin chat backend only**.
- No refactor, redesign, or behavioral change to the current chat UX is allowed.
- MCP is added strictly as an optional capability layer (tools), not as a replacement.

**Collections Exposed (Read-Only):**

- `courses`
- `chapters`
- `lessons`
- `exercises`
- `media`

**Allowed Operations:** READ ONLY

No write, create, update, delete, or side effects.

---

## Goal

Allow authenticated admin users to query core content collections through the existing admin chat using **Payload MCP plugin tools**, in a deterministic, auditable, permission-safe, and **tenant-scoped** way.

The chat can inspect system state but cannot modify it.

---

## Tenant Readiness (Stage 1)

### Tenant Model

- A `tenants` collection exists and contains exactly **one** Tenant representing the current business.
- A Tenant represents a business/workspace (future multi-tenant).

### Tenants Collection (Minimal Fields)

- `name` (text, required)
- `slug` (text, required, unique, indexed)
- `status` (select: active | archived, default: active) (optional)

### Default Tenant Resolution (Server-Side)

- Environment variable: `DEFAULT_TENANT_SLUG`
- Backend resolves `tenantId` by querying `tenants` where `slug == DEFAULT_TENANT_SLUG`.
- Tenant identifiers are **never** accepted from the model.

### Domain Collections Scoped by Tenant

A required relationship field `tenant` (relationship → `tenants`, indexed) exists on:

- Courses
- Chapters
- Lessons
- Exercises
- Media
- UserProgress

All existing records are backfilled to the default Tenant.

### Conversation Context Rule

- `contextRef` remains required for all conversations.
- Global admin chat conversations MUST use:

```
contextRef = tenants:<tenantId>
```

---

## Architecture Overview

```
Admin Chat UI
   ↓
Admin Chat Backend (Node / Next.js)
   ↓  (Gemini tool calling + tenant resolution)
MCP Client (internal service)
   ↓  (HTTP)
Payload MCP Plugin Server
   ↓
Payload Local API (find/findByID)
   ↓
Payload Collections (courses/chapters/lessons/exercises/media)
```

---

## System Boundaries

### In Scope

- Payload MCP plugin enabled in the Payload server
- MCP client inside the admin chat backend
- Read-only access to the listed collections
- Gemini tool/function calling
- Full audit logging
- Tenant-ready data model (single tenant)

### Out of Scope (Hard NO)

- Rebuilding or refactoring the existing admin chat
- Introducing a new chat UI or flow
- Any write capability
- Any non-admin access
- Any other collections
- Memory ingestion or persistence
- Background or autonomous execution
- Multi-tenant workspace selector
- Building a custom MCP protocol server or custom JSON-RPC endpoint (plugin is the server)

---

## MCP Server (Payload Side)

### Plugin

- Use official Payload MCP plugin.
- Transport: HTTP (plugin-provided).

### Tool Exposure

Expose **exactly one logical tool**:

```
content.read
```

**Why one tool?**

- Fewer surface area mistakes.
- Centralized guardrails (filters/limits/field allowlists).
- Easier allowlisting on the client.

### content.read API (Conceptual)

Supported operations:

- `getById({ collection, id })`
- `list({ collection, limit, where, sort })`

**Allowed collections:** `courses | chapters | lessons | exercises | media`

Restrictions:

- Hard limit: `limit <= 10` (default 10)
- Allowed filters: allowlist per collection (no arbitrary fields)
- Allowed sort fields: allowlist per collection
- No deep relationship population

### Tenant Enforcement

- The handler always injects tenant scoping using resolved `tenantId`.
- User-provided filters cannot override tenant scoping.
- Tenant is NOT part of the tool’s public input schema.

### Access Control

- Execute as authenticated admin user.
- Respect existing Payload access rules.
- Deny if user is not admin.

---

## MCP Client (Admin Chat Backend)

### Responsibilities

- Connect to the Payload MCP plugin HTTP endpoint.
- Fetch tool definitions on startup.
- Maintain static allowlist:

```
['content.read']
```

- Reject any tool call outside allowlist.
- Validate tool arguments (schema-level) before execution.
- Resolve default `tenantId` (via `DEFAULT_TENANT_SLUG`) and pass it server-side to the MCP handler via auth/context (not as model-provided args).

### Failure Modes

- MCP unavailable → surface error to chat
- Invalid args → block execution
- Unauthorized → block and log

---

## Chat ↔ Model Integration

### Tool Mapping

- Convert `content.read` input schema to Gemini FunctionDeclaration.
- Provide strict JSON schema for arguments.

### Execution Flow

1. Admin asks a question ("Show last 5 unpublished lessons")
2. Backend calls Gemini **with tools enabled** (admin-only)
3. Gemini emits `content.read` tool call
4. Backend validates tool + args
5. Backend executes tool via MCP client
6. Backend appends tool result to the model context
7. Backend re-calls Gemini to produce the final admin-facing answer

No implicit execution.

---

## Data Contract (Read Results)

No raw Payload documents. Responses must be transformed to allowlisted fields.

Minimum allowlisted fields:

- Courses: `id, title, slug, status, updatedAt`
- Chapters: `id, title, slug, status, order, course.id, course.title, updatedAt`
- Lessons: `id, title, slug, status, order, chapter.id, chapter.title, updatedAt`
- Exercises: `id, title, status, order, lesson.id, lesson.title, updatedAt`
- Media: `id, filename, mimeType, filesize, url, updatedAt`

---

## Audit Logging

Every MCP tool call must log (append-only):

- `adminUserId`
- `tenantId`
- `toolName` (content.read)
- `args` (sanitized)
- `resultCount`
- `timestamp`
- `success` / `failure`
- `requestId` (correlation)
- `durationMs`

---

## Guardrails

### Triple Lock (Read-Only)

1. **Server implementation**: only `getById` + `list` exist
2. **Client allowlist**: only `content.read` is callable
3. **Schema validation**: only read operations are valid

### Tenant Lock

- Tenant scoping is injected server-side.
- Tenant override via args is impossible.

---

## Acceptance Criteria

- Admin can query courses/chapters/lessons/exercises/media via chat.
- Only read operations are possible.
- Results are tenant-scoped.
- No other collections are accessible.
- All calls are logged with `tenantId`.
- Unauthorized attempts are blocked and logged.

---

## Exit Criteria (to move to Stage 2)

- Zero unexpected tool calls
- Stable latency
- Admin trust in correctness of responses
- Explicit decision to add WRITE operations

---

## Required Follow-Up Documents

- MCP Tool Schema Definition (content.read)
- Collection Filter/Sort Allowlist (per collection)
- Tenant Data Migration Plan (backfill + required field rollout)
- Security Review Checklist

---

## Final Rule

This stage proves **observability and control**, not power.
If this stage is not boring, it is wrong.
