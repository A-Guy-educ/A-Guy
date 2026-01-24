תשובה

# High-Level Specification (HLS)

## Stage 4 — Chat Integration (Admin Chat as Automation Control Plane)

### Purpose

Integrate an **Admin Chat interface** that operates as a **safe control plane** for Automations, using the same rules, limits, and validations as the Admin Wizard (Stage 3).
Chat must **not introduce new capabilities**—it is an alternative UI that drives the same engine.

---

## Goals

* Allow admins to create, edit, enable/disable, and inspect Automations via chat
* Reuse **Stage 3 Wizard logic** (no parallel business rules)
* Enforce identical guardrails, limits, and validations
* Provide conversational guidance and clarification questions
* Offer quick observability (“what’s running / what failed”) without debugging

---

## Non-Goals

* No freeform workflow design
* No bypassing Admin Wizard limits
* No secrets exposure
* No deep debugging or n8n graph editing
* No end-user chat (admin-only)

---

## Core Principle

**Chat = UI layer only**
**Wizard + Automations Engine = Source of Truth**

If Chat can do something, the Wizard can do it too—and vice versa.

---

## Capabilities

### Supported Chat Intents (MVP)

1. **Create Automation**

   * “When a lesson is completed, send a message”
   * “If a student is inactive for 3 days, send an email”

2. **Edit Automation**

   * “Change the cooldown to 24 hours”
   * “Disable this automation”
   * “Use a different email template”

3. **Inspect Automation**

   * “What automations are active?”
   * “Why is this automation suspended?”
   * “Show last runs for automation X”

4. **Explain Automation**

   * “What does this automation do?”
   * “Which variables does it use?”

5. **Safety Responses**

   * “This automation exceeds admin-safe limits. Please escalate to a developer.”

---

## Chat Interaction Model

### Intent → Wizard Mapping

Each chat intent is translated into:

* Wizard Step(s)
* Or a Wizard-compatible update (diff)

**Example**
User:

> “Send a reminder email if a student doesn’t log in for 3 days”

Chat:

1. Identifies intent: `create automation`
2. Maps to Wizard flow:

   * Trigger: scheduled → inactive users
   * Variable needed: `inactive_days_threshold`
   * Action: trigger workflow (email)
3. Asks missing questions:

   * “Which email template?”
   * “How often can this run?”

Only after all required fields are collected → create Automation.

---

## MCP / Tooling Layer

### Required MCP Tools (Admin-Only)

* `list_automations()`
* `get_automation(automationId)`
* `create_automation(payload)`
* `update_automation(automationId, diff)`
* `enable_automation(automationId)`
* `disable_automation(automationId)`
* `list_variables()`
* `create_variable(payload)` (inline creation support)
* `preview_automation(automationDraft)`

**Rules**

* Tools validate exactly like Wizard endpoints
* Tools reject any request that violates Stage 3 limits

---

## Validation & Guardrails

### Hard Stops (same as Stage 3)

Chat must refuse and explain when:

* > 2 conditions requested
* Multiple actions requested
* Unsupported schedule requested (freeform cron)
* Non-allowlisted workflow requested
* Missing or disabled variable key

### Clarification Questions

Chat must ask when:

* Trigger details missing
* Variable value/key unclear
* Action target ambiguous

Chat must **never guess**.

---

## Variable Handling in Chat

* Chat prefers existing variable keys
* If admin types a raw number/text:

  * Chat proposes creating or reusing a Variable
  * Inline variable creation allowed via MCP tool
* Chat never hard-codes values into Automations

---

## Observability via Chat

### Supported Queries

* “What automations are active?”
* “Show last 5 runs of automation X”
* “Why is automation X suspended?”

### Response Rules

* Summarize status and last outcome
* Do not expose stack traces
* Point to Admin UI for deeper inspection if needed

---

## Security & Permissions

* Chat accessible only to Admin roles
* Every mutation records:

  * actor
  * timestamp
  * before/after diff (via existing audit)
* Chat cannot elevate permissions or override system suspensions

---

## Failure & Safety Messaging

When blocked, Chat responds with:

* Clear reason
* Suggested next step (e.g., “Open in Admin UI” or “Escalate to developer”)

No silent failures.

---

## Acceptance Criteria

* Admin can create an automation via chat end-to-end
* Chat enforces identical limits as Wizard
* Chat never creates invalid Automations
* Variables are reused or created correctly
* Chat can explain and disable automations
* All actions are auditable and visible in Admin UI

---

# Tests — Stage 4 (Chat Integration)

## Unit Tests

* Intent parsing → correct Wizard mapping
* Clarification logic:

  * missing trigger → question asked
  * ambiguous variable → proposal made
* Refusal logic:

  * blocks multi-action requests
  * blocks >2 conditions

## Integration Tests

* Chat → create automation → Automation stored correctly
* Chat → update automation → diff applied correctly
* Chat → inline variable creation → Variables updated + referenced
* Chat → disable automation → status updated

## Contract Tests (MCP)

* Tool inputs validated server-side
* Invalid payloads rejected consistently with Wizard endpoints
* No tool allows bypassing limits

## Safety Tests

* Chat cannot:

  * inject raw secrets
  * hard-code values
  * trigger non-allowlisted workflows
* Suspended automations cannot be re-enabled without explicit admin action

---

## Exit Criteria

* Chat and Wizard produce identical Automations for the same intent
* No duplicate business logic between Chat and Wizard
* Admin can operate the full lifecycle (create → edit → inspect → disable) via chat
* Complex requests are consistently refused with clear messaging

---
