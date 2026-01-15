# PLAN OF PLANS

> **For AI Agents**: Convert approved spec into verifiable execution plan.

## Goal

Convert any **Feature Spec** into a **small, verifiable execution plan** that an agent can follow without improvising scope.

---

## Plan File Location

`.tasks/[task-name]/plan.md` (e.g., `.tasks/email-verification-endpoint/plan.md`)

**Output Optimization**: Generated plans MUST follow `docs/specs/PROMPT-OPTIMIZER.md`:
- Dense, scannable format (bullets, tables, symbols)
- Minimal prose (≤2 sentences per concept)
- Templates in code blocks
- No redundant explanations

---

## Inputs (Required)

The plan MUST reference:

* Feature Spec (the "what") - located at `.tasks/[task-name]/spec.md`
* Spec of Specs (test contract)
* **ENGINEERING-CONSTRAINTS.md** (mandatory)

If any input is missing **or constraints are violated** → the plan is invalid.

---

## Principles (Non-Negotiable)

* **Traceability:** every plan item maps to a spec requirement
* **Small batches:** prefer PR-sized slices
* **Risk-first:** tackle unknowns and high-risk parts early
* **Verification is work:** tests/CI gates are part of the deliverable

---

## Plan Format (Mandatory)

### 1) Overview

* Objective (1–2 sentences)
* Impact: `low | medium | high`
* Rollout: `safe default | feature flag | breaking change`

---

### 2) Requirements → Plan Map (Trace Table)

For each spec requirement:

* `Requirement → Stage(s) → PR(s) → Tests`

Rule: if a requirement has no mapping → plan is invalid.

---

### 3) Stages (3–7, ordered)

Each stage MUST include:

* **Scope:** what changes (no implementation detail)
* **Deliverables:** explicit artifacts
* **Verification:** how it will be proven
* **Exit criteria:** measurable pass/fail
* **Constraints check:** `compliant | deviation (must be explicit)`
* **Risk note:** what can break

Stage template:

* **Stage X: <title>**

  * Scope:
  * Deliverables:
  * Verification:
  * Exit criteria:
  * Constraints check:
  * Risk note:

---

### 4) Test Plan (Staged)

* Reference the spec test inventory
* Specify which behaviors are covered in which stage
* Include at least one **red-first** test for a critical behavior (regression or core path)

---

### 5) Data & Migration (Only if applicable)

* Changes: `none | schema | data`
* Migration: `none | forward-only | reversible`
* Backfill plan (if needed)
* Rollback implication

If data changes exist and this section is missing → plan is invalid.

---

### 6) Rollout & Monitoring

* Environments: `dev → prod`
* Feature flag strategy (if used)
* Monitor: errors/logs + the 1–3 key user flows
* Success / failure signals

---

### 8) Stop Conditions

DONE only if:

* All stages meet exit criteria
* All spec behaviors have tests and pass in CI
* **Engineering constraints are respected**
* Rollout completed (or explicitly deferred with reason)

---

## Agent Rules

Agents MUST:

* Keep every item traceable to the spec
* Refuse scope creep
* Refuse constraint violations (unless explicit deviation is approved)
* Never merge without verification

---

## Plan Quality Gate (Checklist)

A plan is ACCEPTABLE only if:

* Inputs are referenced (incl. ENGINEERING-CONSTRAINTS.md)
* Every requirement is mapped
* Stages include verification + exit criteria
* Test plan is staged (not “later”)
* Constraints compliance is stated per stage
