# Spec of Specs – Agent TDD Contract

## Goal

Define a **strict, minimal, repeatable contract** for how task specs must define tests (TDD-oriented) so that any agent produces **predictable, verifiable, non-bullshit output**.

This document defines **how to write specs**, not how to write code.

---

## Core Principles (Non‑Negotiable)

1. **Behavior over implementation**
   Specs define *what must be true*, never *how it is implemented*.

2. **Deterministic outcomes**
   Every behavior must have a clear pass/fail condition.

3. **Minimal sufficiency**
   Only test what protects value, correctness, or safety.

4. **Black‑box first**
   Tests must validate observable behavior, not internal structure.

5. **Agent autonomy within guardrails**
   The agent writes the tests, but only inside the declared boundaries.

---

## Mandatory Spec Sections

Every task spec **MUST** include the following sections, in this order.

---

### 1. Scope

**Purpose:** Define what the change is about and what domain it touches.

Must include:

* Feature / module / system name
* Type of change: `bugfix | refactor | feature | infra`
* Impact level: `low | medium | high`

Must NOT include:

* Implementation hints
* File paths

---

### 2. Behaviors to Cover (Test Inventory)

**Purpose:** Define *what must be tested*, not how.

Rules:

* Use **behavioral language** only
* Each bullet must be testable
* No more than:

  * 6 behaviors for small changes
  * 15 behaviors for large or critical changes

Categories (use only what applies):

* Happy path
* Edge cases
* Failure modes
* Permissions / security
* Regression

Example (structure only):

* Should X when Y
* Should not X when Z

---

### 3. Expected Outcomes

**Purpose:** Define what “success” means for each behavior.

Rules:

* Outcome must be observable
* One outcome per behavior
* Use system‑level language

Allowed:

* HTTP status
* Returned value / shape
* Side effects (persisted / not persisted)
* External calls (called / not called)

Forbidden:

* Internal variables
* Function calls unless externally observable

---

### 4. Out of Scope (Explicit Exclusions)

**Purpose:** Prevent over‑testing and wasted effort.

Must explicitly state:

* Test types not required (e.g. E2E, UI, performance)
* Domains not covered
* Known limitations accepted for this task

If this section is missing → spec is invalid.

---

### 5. Test Boundaries

**Purpose:** Define how far tests may reach.

Must specify:

* Allowed test level: `unit | integration | mixed`
* Whether mocking is allowed
* External services: `mocked | real | forbidden`

Default (if not specified):

* Unit + integration
* External services mocked

---

### 6. Stop Conditions

**Purpose:** Define when the task is considered DONE.

Must include ALL:

* All defined behaviors have tests
* All tests pass
* No unrelated tests added
* No snapshot-only tests (unless explicitly allowed)

Optional (but recommended):

* Coverage expectation (qualitative, not %)

---

## Hard Rules for Agents

Agents MUST:

* Write tests before or alongside implementation
* Fail the task if spec is ambiguous
* Ask for clarification if behavior is not testable

Agents MUST NOT:

* Invent behaviors
* Skip behaviors silently
* Add tests outside declared scope

---

## 7. Deliverables

**Purpose:** Make outputs explicit and enforceable.

Must declare:

* Tests added or updated for each defined behavior: `yes`
* CI passing (tests, lint, typecheck): `required`
* Docs / messages updated (if user-facing): `yes | no`
* Migrations required (if schema or data changes): `yes | no`

If Deliverables are not fully satisfied → task is NOT complete.

---

## 8. Risk & Rollback

**Purpose:** Prevent irreversible or blind changes.

Must include:

* What can break if this change is wrong
* Blast radius (local | service | system)
* Rollback strategy:

  * Revert PR
  * Feature flag disable
  * Migration rollback or forward-fix

If no rollback path exists → must be explicitly stated and approved.

---

## Validation Checklist (Spec Quality Gate)

A spec is ACCEPTABLE only if:

* All mandatory sections exist (1–8)
* Every behavior has a matching expected outcome
* Out-of-scope is explicit
* Stop conditions are measurable
* Deliverables are explicit
* Risk & rollback are defined

If one item fails → spec must be rejected.

---

## Design Intention (Read This Once)

This contract exists to:

* Prevent false confidence
* Eliminate "tests that test nothing"
* Enable fast, safe agent autonomy

If a spec feels uncomfortable to write — it probably protects you from a bug you haven’t seen yet.
