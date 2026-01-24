תשובה

# High-Level Specification (HLS)

## Stage 2 — Automations Architecture (Events → Rules → n8n Execution)

### Purpose

Implement the core automation engine that connects **system events** (and scheduled checks) to **admin-managed automation rules**, and triggers **n8n workflows** as the execution engine. This stage must integrate with **Stage 1 Variables** (resolved values, not hard-coded literals).

---

## Goals

* Provide an admin-manageable “When X happens → do Y” automation system
* Support two trigger modes:

  * **Event-based** (immediate)
  * **Schedule-based** (periodic polling)
* Trigger **n8n workflows** with a standard payload envelope
* Enforce lifecycle, safety guardrails, and observability (runs/logs)
* Use **Variables** for thresholds/templates/limits (no hard-coded config)

---

## Non-Goals

* No freeform workflow design in Payload (n8n remains the designer)
* No complex expressions language for filters
* No multi-action automations in MVP (Action = one target)
* No full Chat Wizard (Stage 3)

---

## Core Concepts

### EventType (Catalog)

A dev-defined list of events the system can emit (schema + meaning). Admin cannot invent new EventTypes.

### Automation (Rule)

A single rule that connects:

* Trigger (event OR schedule)
* Conditions (simple)
* Target (n8n workflow)
* Guardrails (cooldown, rate limits)
* Status (enabled, suspended)

### Dispatcher

A server-side component that:

* Receives events (or schedule ticks)
* Finds matching automations
* Evaluates conditions
* Resolves variables
* Triggers n8n
* Records runs

---

## Data Model

### Collection: `EventTypes` (Catalog)

**Fields**

* `eventType` (string, unique) e.g. `lesson.completed`
* `description` (string)
* `payloadSchema` (json) (lightweight schema for documentation/validation)
* `enabled` (boolean)

> Source of truth for event names and expected payload shape.

---

### Collection: `Workflows` (Catalog)

**Fields**

* `workflowId` (string, unique; from n8n)
* `name` (string)
* `description` (string)
* `inputSchema` (json, optional)
* `enabled` (boolean)
* `adminEditable` (boolean) (used later in Stage 3/4)

> This is an allowlist and metadata registry for n8n flows.

---

### Collection: `Automations`

Automation is the admin-managed rule.

**Fields**

* `name` (string)
* `enabled` (boolean)
* `status` (enum): `active | disabled | suspended`
* `suspendReason` (string, optional)

**Trigger**

* `triggerType` (enum): `event | schedule`
* If `event`:

  * `eventType` (relationship to EventTypes)
* If `schedule`:

  * `schedule` (string, MVP format: `daily@09:00`, `hourly`, `every_15m`)
  * `scheduleTimezone` (string, default `Asia/Jerusalem`)

**Conditions (simple, MVP)**

* `conditions` (array of condition objects, max 2)

  * `{ fieldPath, op, value }`
  * `op` in: `eq | ne | lt | lte | gt | gte | in | contains`
  * `fieldPath` refers to event payload or derived context

**Target**

* `workflow` (relationship to Workflows)
* `workflowMode` (enum): `sync | async` (MVP: async)
* `workflowInput` (json template, optional; minimal mapping)

**Guardrails**

* `cooldownSeconds` (number, default 0)
* `maxRunsPerHour` (number, optional)
* `dedupeKeyPath` (string, optional) e.g. `payload.userId`

**Variables**

* `variableKeysUsed` (array<string>)
  Declared list of variable keys required for this automation (resolved at trigger time).

**Metadata**

* `createdBy`, `updatedBy`, timestamps

---

### Collection: `AutomationRuns`

Operational log.

**Fields**

* `automation` (relationship)
* `triggerType` (`event|schedule`)
* `eventType` (string, optional)
* `workflowId` (string)
* `status` (enum): `started | succeeded | failed | skipped`
* `startedAt`, `finishedAt`
* `errorCode`, `errorMessage` (short)
* `inputSnapshot` (json; minimal, safe)
* `context` (json; courseId/programId/userId if applicable)
* `n8nExecutionId` (string, optional)
* `dedupeKey` (string, optional)

---

## Event Bus Interface (Internal)

### Emit Event

A simple internal function used by app code:

* `emitEvent(eventType, payload, context)`

**Context**

* `userId?`
* `courseId?`
* `programId?`

> MVP implementation can be “in-process dispatcher call” (no external queue). If later needed, replace with a proper queue without changing Automations API.

---

## Schedule Triggering (No Cron in App)

### Scheduler Strategy

* n8n can run schedules, but Stage 2 needs a baseline. Pick one MVP approach:

**Recommended MVP (simple): app-owned scheduler**

* A single server job runner tick (e.g. every minute) that checks due schedules and runs them.
* Reason: keeps “automations defined in Payload” consistent, without requiring n8n schedules per automation.

**Alternative (n8n-owned scheduler):**

* A single n8n cron calls `POST /automation/schedule-tick` and app decides what’s due.
* Also acceptable if you prefer n8n to handle timing.

Either way, the scheduling logic must:

* select due automations
* enforce rate limits
* create runs
* execute target workflow

---

## Dispatcher Logic

### Event-Based Dispatch

1. Receive `(eventType, payload, context)`
2. Load enabled automations where:

   * `triggerType=event`
   * `eventType matches`
   * `status=active`
3. For each automation:

   * Evaluate conditions (max 2)
   * Enforce cooldown/dedupe
   * Resolve variables (Stage 1 `resolveVariables`)
   * Build workflow payload envelope
   * Trigger n8n workflow
   * Record run: started → success/fail

### Schedule-Based Dispatch

1. On tick:
2. Find due automations with `triggerType=schedule`
3. For each:

   * Compute “query” via automation definition (MVP: schedule automations call a fixed internal endpoint you own, like `inactive-users`, later configurable)
   * Enforce cooldown/dedupe
   * Resolve variables
   * Trigger n8n workflow
   * Record runs

> MVP recommended limitation: schedule automations support only predefined “scheduled triggers” (e.g. `inactive_users`) rather than arbitrary queries.

---

## Payload Envelope to n8n

When triggering n8n, always send:

```json
{
  "automation": {
    "automationId": "...",
    "name": "...",
    "triggerType": "event",
    "eventType": "lesson.completed"
  },
  "context": {
    "userId": "...",
    "courseId": "...",
    "programId": "..."
  },
  "payload": { /* raw event payload OR scheduled result item */ },
  "variables": { /* resolved key->value */ }
}
```

Rules:

* No secrets in payload
* Variables are resolved values only
* Keep payload minimal (IDs preferred)

---

## Safety & Lifecycle

### Auto-Suspension Policy (MVP)

* If an automation fails **N times in a row** (default N=5) → set `status=suspended`
* Store `suspendReason` with latest error summary
* Admin can re-enable manually

### Guardrail Defaults

* `cooldownSeconds`: required for messaging-like automations (recommend min 3600)
* `maxRunsPerHour`: default 100 (tunable via Variables)

---

## Observability (Admin View Requirements)

* Automations list shows:

  * status, enabled
  * lastRunAt, lastStatus
  * failureCountRecent (last 24h)
* Automation detail shows:

  * last 20 runs
  * ability to disable immediately
  * suspend reason if suspended

---

## Integration with Stage 1 Variables

* Each automation declares `variableKeysUsed`
* Dispatcher resolves them per event context:

  * course/program scoped values override global
* Missing variable is a **hard failure** (record run as failed, may contribute to suspension)

---

## Acceptance Criteria

* Admin can create an Event-based automation that triggers a chosen n8n workflow
* Admin can create a Schedule-based automation that runs on a defined schedule tick
* Runs are recorded with status and error summaries
* Cooldown/dedupe prevent repeated spam
* Variable resolution is used (no hard-coded thresholds/templates)
* After repeated failures, automation becomes `suspended`

---

# Tests — Stage 2 (Automations Architecture)

## Test Strategy

* **Unit tests** for dispatcher logic (conditions, cooldown, dedupe, variable resolution calls, payload envelope building)
* **Integration tests** for Payload collections + hooks + run logging
* **Contract tests** for n8n trigger request shape (mock n8n endpoint)

---

## Unit Tests

### Dispatcher — Event-based

* Finds only matching automations:

  * `triggerType=event`, `eventType=...`, `status=active`, `enabled=true`
* Condition evaluation:

  * `eq/ne/lt/lte/gt/gte/in/contains` on payload fields
  * max 2 conditions enforced (reject save or ignore extras per spec)
* Cooldown behavior:

  * same dedupeKey within cooldown → run status `skipped`
* Dedupe key derivation:

  * from `dedupeKeyPath` (e.g. payload.userId)
* Variable resolution:

  * calls Stage 1 resolver with declared keys and context
  * fails if resolver fails (run failed)
* Payload envelope:

  * includes automation metadata, context, payload, variables
  * never includes secrets

### Dispatcher — Schedule-based

* Selects due automations based on schedule rules
* Rate limiting: `maxRunsPerHour`
* Cooldown applied per dedupeKey or per automation default
* Triggers workflow for each due automation, logs run

### Auto-suspension

* After N consecutive failures:

  * automation status becomes `suspended`
  * suspendReason set
* On success:

  * consecutive failure counter resets (if tracked)

---

## Integration Tests (Payload)

### Models & Constraints

* `EventTypes.eventType` unique
* `Workflows.workflowId` unique
* `Automations` validation:

  * event trigger requires eventType
  * schedule trigger requires schedule format
  * workflow must exist and be enabled
  * conditions array max length = 2
  * variableKeysUsed must reference existing Variables keys (optional strictness: validate at save or at run)

### Runs Logging

* On trigger:

  * creates `AutomationRuns.started`
  * updates to `succeeded/failed/skipped`
  * stores `n8nExecutionId` when available
* Error truncation:

  * errorMessage limited (no stack dumps in admin)

### Lifecycle

* disabling an automation stops execution
* suspended automation does not execute until re-enabled

---

## Contract Tests (n8n)

* Mock n8n webhook endpoint:

  * verify request body matches payload envelope schema
  * verify headers/auth are present (if used)
* Failure responses:

  * n8n 500 → run failed, contributes to suspension
  * network timeout → run failed

---

## CI Gate

* Add Stage 2 tests to the standard suite:

  * unit + integration
  * ensure deterministic timing (use fake timers for schedules/cooldowns)

---
