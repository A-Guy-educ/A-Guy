# High-Level Specification (HLS)

## Stage 3 — Admin Wizard (Non-Technical Automation Builder)

### Purpose

Provide a **non-technical Admin Wizard** inside Payload that allows admins to create and edit Automations safely using guided questions (Trigger → Conditions → Action), without exposing n8n steps, HTTP, or implementation details. The Wizard writes to **Stage 2 Automations** (rules) and uses **Stage 1 Variables** for values.

---

## Goals

- Enable non-technical admins to create Automations without knowing workflows, endpoints, or scheduling mechanics
- Enforce hard limits (complexity boundaries) and safety guardrails
- Convert “intent” into a valid `Automation` document (Stage 2)
- Reuse variables: admins select/define Variable keys instead of typing raw constants
- Provide preview + dry-run validation before activation

---

## Non-Goals

- No freeform flow design (n8n remains the flow designer)
- No chat interface (Stage 4)
- No multi-action automations (MVP: one action target)
- No advanced boolean logic (MVP: max 2 conditions, AND only)

---

## Core UX Model

### Admin sees “Rules”, not “Workflows”

Wizard creates **Automation Rules** that _reference_ a target n8n workflow from the Workflows catalog.

---

## Wizard Capabilities

### 1) Create Automation (Wizard Flow)

**Step A — Name & Intent**

- `name` (required)
- Optional `description` (optional)

**Step B — Select Trigger (pick one)**
Trigger types (MVP):

- **Event Trigger**: choose from `EventTypes` catalog
- **Schedule Trigger**: choose from a small set of “scheduled triggers” (predefined templates), not freeform cron:
  - `inactive_users_check` (example)
  - `daily_summary` (example)

> Key rule: non-technical admins must not write cron strings or API queries.

**Step C — Configure Trigger Details**

- If Event:
  - pick `eventType`

- If Schedule:
  - pick frequency preset (daily / hourly / every 15m)
  - pick time if daily
  - timezone fixed to `Asia/Jerusalem` (MVP)

**Step D — Add Conditions (optional, max 2)**
Condition builder UI (simple):

- Field dropdown (derived from event payload schema + common context fields)
- Operator dropdown
- Value input
- AND only

**Supported operators**
`eq | ne | lt | lte | gt | gte | in | contains`

**Value entry rules**

- Prefer selecting a **Variable key** when applicable (e.g., thresholds)
- For enums/ids, offer dropdown if known

**Step E — Select Action (MVP: 1 action)**
Action types:

- `trigger_n8n_workflow` (the only action in Stage 3)
  - choose target workflow from Workflows catalog (allowlist)
  - choose execution mode: async only (MVP)

**Step F — Guardrails**

- `cooldownSeconds` (required for “messaging-like” patterns; Wizard enforces recommended defaults)
- `maxRunsPerHour` (optional; default comes from Variable if present, else safe constant)
- `dedupeKeyPath` (Wizard chooses a safe default based on trigger, admin can select from a short list)
  - e.g., `context.userId` for user-centric events

**Step G — Variables**

- Wizard asks which variable keys are required (or infers from selected conditions/action templates)
- Admin can:
  - select existing variable keys
  - create a new variable inline (opens Variable Manager create modal)

- Wizard stores `variableKeysUsed`

**Step H — Preview & Validate**

- Show a summary:
  - Trigger + conditions + action + guardrails

- “Validate” runs server-side checks:
  - Workflow exists/enabled
  - EventType exists/enabled
  - Variable keys exist/enabled
  - Condition fields valid for selected trigger schema
  - Complexity within limits

- Then allow “Create as Draft” or “Create & Activate”

---

### 2) Edit Automation (Wizard)

- Load existing Automation into wizard
- Allow edits with the same validations
- Any change to high-risk fields prompts confirmation:
  - trigger change
  - workflow change
  - cooldown decrease
  - maxRunsPerHour increase

---

## Complexity Boundaries (Hard Stops)

Wizard must block and require developer handoff if:

- Conditions > 2
- Trigger includes unsupported schedule type (freeform cron)
- Automation attempts multiple actions
- Workflow is not allowlisted (`adminEditable=false` or `enabled=false`)
- Dedupe cannot be derived safely

When blocked, show:

- “This automation exceeds admin-safe limits. Please escalate to a developer.”

---

## Data Writes (Stage 2 Compatibility)

Wizard creates/updates exactly one `Automations` document with:

- `triggerType`
- `eventType` or `schedule`
- `conditions[]` (≤ 2)
- `workflow` reference
- `cooldownSeconds`, `maxRunsPerHour`, `dedupeKeyPath`
- `variableKeysUsed`
- `enabled` + `status`

Draft behavior (MVP recommendation):

- `status=disabled` for draft
- activation requires explicit toggle

---

## Admin Safety & Permissions

- Only admin roles can create/edit automations
- Non-admin can view (optional)
- Audit trail:
  - record who created/updated
  - reason required for high-risk edits (optional but recommended)

---

## Observability Hooks

Wizard surfaces:

- Last run status (from `AutomationRuns`)
- “Disable now” button
- Suspend reason if suspended

Wizard does not debug runs; it provides handoff messaging.

---

## Acceptance Criteria

- A non-technical admin can create an event-based automation end-to-end without seeing n8n details
- A non-technical admin can create a schedule-based automation using presets
- Wizard enforces limits and blocks complex cases
- Wizard requires/uses Variables for thresholds/templates
- Wizard validates and previews before activation
- Editing an automation preserves constraints and confirmations

---

# Tests — Stage 3 (Admin Wizard)

## Unit Tests

- Wizard-to-Automation mapping:
  - creates correct `Automations` shape for event trigger
  - creates correct `Automations` shape for schedule preset

- Limits enforcement:
  - blocks >2 conditions
  - blocks multi-action configuration
  - blocks non-allowlisted workflow

- Guardrail defaults:
  - sets cooldown default when trigger implies messaging
  - selects dedupeKeyPath default correctly

## Integration Tests (Payload)

- Create automation via wizard flow:
  - validates EventType/workflow/variables
  - writes Automations doc correctly

- Edit automation:
  - changing trigger/workflow prompts confirmation (test server validation gate)
  - decreasing cooldown below safe minimum blocked (if implemented)

- Inline variable creation:
  - variable created in Variables collection
  - automation references variable key in `variableKeysUsed`

## UI/Flow Tests (lightweight)

- Wizard steps accessible in order
- Cannot proceed when required fields missing
- Preview summary matches saved rule

## Contract Tests

- Validate endpoint returns actionable errors:
  - missing variable key
  - workflow disabled
  - invalid condition fieldPath for event schema

---
