# Product Requirements Document (PRD)

## Title

Admin Chat with MCP-Powered System Capabilities (Tenant-Ready)

---

## Goal

Enable administrators to use the existing internal admin chat as an **operational control surface** by safely connecting it to Payload via MCP, allowing structured read/write actions on system data.

The system must be **tenant-ready** while remaining deterministic, auditable, and permission-bound.

---

## Problem Statement

### Current State

- Admin chat exists and is already connected to a Google model (Gemini).
- Chat can reason and respond, but **cannot act** on system data.
- All operational actions require manual admin UI interaction.

### Pain

- High-friction admin workflows (content fixes, inspections, bulk actions).
- No controlled way for AI to assist with real system operations.

### Risk

- Naively adding AI actions without structure leads to data corruption, security holes, and non-reproducible behavior.

---

## Non-Goals (Hard NO)

- No end-user / student chat integration
- No autonomous or background execution
- No unrestricted write access
- No replacement of existing admin UI
- No analytics, memory ingestion, or long-term agent autonomy
- No full multi-tenant UI (workspace selector) in this phase

---

## Target Users

- System Administrators
- Content Managers
- Developers (internal tooling only)

All users are authenticated admin users.

---

## Tenant Model (Foundational Decision)

### Tenant Definition

A **Tenant represents a business/workspace**.

At this stage:

- The system operates with **a single Tenant** representing the current business.
- The data model is prepared for future multi-tenant expansion.

### Tenant as Global Context Anchor

- All global admin chat conversations are associated with the Tenant via `contextRef`.
- This replaces the need for a separate `AdminConsole` entity.

---

## High-Level Solution

Introduce **MCP as a controlled capability layer** between:

Admin Chat (Host) → MCP Client → Payload MCP Server → Payload Collections

- The admin chat remains the decision-maker.
- MCP executes only **explicit, validated tool calls**.
- All actions occur **within the scope of a Tenant**.

---

## Core Capabilities (Phase 1)

### 1. Read Operations (Required)

The chat can:

- Fetch a single document by ID
- List documents with filters (limited)
- Inspect schema-level metadata

Collections allowed (initial):

- Lessons
- Exercises
- Media

Read-only, no side effects.

---

### 2. Write Operations (Restricted – Future Phase)

Explicit admin-approved actions only:

- Create draft content
- Update specific whitelisted fields
- Toggle status flags (draft / published)

Write operations must:

- Be explicitly requested by the admin
- Require confirmation before execution

---

## Data Model Requirements (Tenant-Ready)

### Tenants Collection

- A new `tenants` collection exists.
- Initially contains **one Tenant document** representing the current business.

### Tenant Relationship

The following collections include a required relationship field:

- Courses
- Chapters
- Lessons
- Exercises
- Media
- UserProgress

All existing records are backfilled to the default Tenant.

### Default Tenant Assignment

- New content is automatically assigned to the default Tenant.
- The default Tenant is resolved server-side via environment configuration.

---

## Conversation Context Rules

- `contextRef` remains required for all conversations.
- Global admin chat conversations use:

```
contextRef = tenants:<tenantId>
```

- Context-specific chats (e.g., lesson edit screens) may still use:

```
contextRef = lessons:<lessonId>
```

---

## Functional Requirements

### Chat Layer

- Reuses the existing admin chat UI and flow (hard constraint).
- Supports tool/function calling.
- Displays tool intent before execution.
- Shows execution results inline.
- Supports manual cancel / deny.

### MCP Client Layer

- Connects to Payload MCP over HTTP.
- Fetches available tools on startup.
- Maintains an explicit allowlist of enabled tools.
- Validates arguments before execution.

### MCP Server (Payload)

- Exposes only whitelisted collections.
- Enforces Payload access control.
- Executes actions as the authenticated admin user.

---

## Security & Guardrails

- Admin authentication required.
- Role-based access enforcement.
- Tool-level allowlists.
- Argument schema validation.
- No implicit execution.
- Full audit logging.

Every action must log:

- Admin user ID
- Tenant ID
- Tool name
- Arguments
- Result
- Timestamp

---

## UX Requirements

- Clear separation between:
  - Chat reasoning
  - Proposed action
  - Executed action

- Execution must be explicit and visible.

- Errors must be surfaced verbosely.

---

## Acceptance Criteria

- Admin can ask: "Show me the last 5 unpublished lessons".

- Chat performs an MCP read call scoped to the Tenant and returns structured data.

- Unauthorized action attempts are blocked and logged.

---

## Risks

- Over-exposing MCP tools
- Silent or implicit execution
- Confusing chat output with actual system state

All risks are mitigated via explicit execution, tenant scoping, and audit logs.

---

## Rollout Plan

### Stage 1

- Tenant-ready data model
- Read-only MCP tools
- Single Tenant

### Stage 2

- Restricted write tools
- Explicit confirmation UX

### Stage 3

- Expanded collection coverage
- Optional workspace selector

---

## Recommended Supporting Documents

- High-Level Technical Spec (required)
- MCP Tool Allowlist Definition (required)
- Tenant Data Migration Plan (required)
- Security & Audit Logging Spec (recommended)

---

## Success Metrics

- Reduced manual admin UI actions
- Zero unauthorized writes
- Full traceability of AI-assisted actions

---

## Final Constraint

The admin chat is an **assistant**, not an operator.

All system changes remain the responsibility of a human administrator.
