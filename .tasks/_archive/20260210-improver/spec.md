# Spec: “Auditor” Agent (v1.0)

## Goal

Introduce a dedicated **Auditor** agent that runs on **every task run** (success or failure) and outputs **one concrete process improvement** (success path) or **one concrete prevention improvement** (failure path), enforced by the Orchestrator as a **mandatory gate**.

## Non-Goals

- The Auditor does **not** implement code changes.
- The Auditor does **not** redesign the architecture.
- The Auditor does **not** generate multiple improvements per run.
- The Auditor does **not** replace verification/testing.

## Why This Exists

Without a mandatory, structured improvement loop, your process will drift:

- recurring friction won’t be fixed
- missing guardrails won’t be codified
- the same failures will repeat
- knowledge stays in people’s heads instead of becoming repo artifacts

---

## Definitions

### Orchestrator (Conductor Script)

The system controller that:

- triggers agents in sequence
- collects outputs
- decides whether the task can close
- creates follow-up tasks automatically when required

### Task Run

One end-to-end orchestration attempt for a single task, producing:

- specs / prompts used
- execution logs / diffs / artifacts
- verifier output
- final state (SUCCESS | FAILURE | ABORTED)

### Improvement Artifact

A durable change that reduces future friction, e.g.:

- doc update
- index update
- guardrail rule
- prompt update
- CI check / lint rule
- naming / folder rule

---

## System Invariants (Hard Rules)

1. **Auditor must run on every task run** (SUCCESS or FAILURE).
2. Auditor output must be **structured** and machine-readable.
3. Auditor must choose **exactly one** improvement item per run.
4. If Auditor cannot produce a concrete improvement artifact, it must set `can_close = false`.
5. Orchestrator must **block closure** if:
   - Auditor output missing
   - schema invalid
   - `can_close = false`

6. On failure runs, Orchestrator must block retry unless:
   - Auditor produced a prevention improvement
   - and classified the failure (Spec/Prompt vs Context vs Execution)

---

## Inputs (Shared)

The Auditor receives a **Run Bundle**:

### Required Inputs

- Task ID / Title
- Task Spec (as given to the agents)
- Orchestrator timeline (agent sequence + timestamps)
- Agent outputs summaries (Planner/Executor/Verifier)
- Final state: SUCCESS | FAILURE | ABORTED
- Primary artifacts produced (diff summary, file list, docs changed)

### Optional Inputs

- Full logs
- Tool errors / stack traces
- CI output
- Cost/usage metrics

---

## Outputs (Shared)

### Output Format

Auditor must output a single JSON (or structured block) with:

- `runId`
- `taskId`
- `runState`: `SUCCESS | FAILURE | ABORTED`
- `classification`: `SPEC_PROMPT | CONTEXT | EXECUTION | UNKNOWN`
- `processDelta`: array of up to 4 short bullets
- `chosenImprovement`: exactly one item:
  - `type`: `DOC | INDEX | GUARDRAIL | PROMPT | AUTOMATION | NAMING_STRUCTURE`
  - `title`: short imperative
  - `rationale`: 1–2 sentences
  - `whereItLives`: file path(s) or rule identifier
  - `acceptanceCriteria`: 2–5 checks

- `canClose`: boolean
- `followUpRequired`: boolean (derived: `!canClose` or failure prevention required)
- `retrySafe`: `YES | NO | UNKNOWN` (Phase 2 relevant)
- `notes`: optional, max 3 bullets

### Output Constraints

- No more than **one** `chosenImprovement`.
- `processDelta` max **4 bullets**.
- `acceptanceCriteria` must be testable/verifiable (not vibes).

---

# Phase 1: Auditor on Successful Runs

## Trigger Condition

`runState = SUCCESS`

## Primary Objective

Convert “what was painful / unclear / repeated” into **one durable improvement artifact**.

## What Auditor Must Evaluate (Success Path)

### A) Friction Signals

- Did agents ask repeated questions?
- Did the orchestrator have to retry due to preventable issues?
- Did the verifier fail on first attempt but later pass after manual tweaks?
- Did changes require “tribal knowledge” not in docs?

### B) Spec Quality

- Were requirements ambiguous?
- Were guardrails missing?
- Were acceptance criteria too weak?
- Was scope too large (needed splitting)?

### C) Execution Quality

- Did executors diverge from spec?
- Were there inconsistent patterns or naming?
- Was time wasted on avoidable context hunting?

## Mandatory Success Output Rules

On success runs, Auditor must always produce:

- classification (even if `UNKNOWN`)
- at least 1 processDelta bullet
- one chosenImprovement with:
  - `whereItLives` pointing to repo artifact
  - acceptanceCriteria that can be checked by reviewer/CI

## Examples of Valid Success Improvements

- Add a “Task Template: Process Delta” section in the task doc standard
- Update the “agent prompts index” with a new rule
- Add a guardrail in orchestrator: fail if verifier didn’t run
- Add a doc snippet: “common failure modes + resolution steps”

## Orchestrator Enforcement (Success)

Orchestrator must:

- validate output schema
- ensure exactly one improvement
- ensure `whereItLives` is not empty
- block close if `canClose=false`

---

# Phase 2: Auditor on Failed Runs

## Trigger Condition

`runState = FAILURE | ABORTED`

## Primary Objective

Produce a **failure diagnosis** and **one preventive improvement** that makes the failure less likely to repeat, and determine whether a retry is safe.

## Failure Classification (Mandatory)

Auditor must classify into one:

### 1) SPEC_PROMPT

Symptoms:

- unclear requirements
- missing constraints
- agents interpreted spec differently
- acceptance criteria absent/weak

Prevention examples:

- strengthen task template
- add “must ask clarifying questions” rule
- add explicit constraints section

### 2) CONTEXT

Symptoms:

- missing files / missing indexes
- insufficient repo pointers
- absent environment config / secrets
- tool cannot access required context

Prevention examples:

- add required context checklist
- add “context pack” index
- add orchestrator preflight checks

### 3) EXECUTION

Symptoms:

- runtime errors
- build/test failures
- tool errors
- implementation mistakes

Prevention examples:

- add preflight CI step
- add minimal reproduction/test
- add “do not proceed if X” guardrail

### 4) UNKNOWN

Only allowed if logs are missing or insufficient; must include a prevention improvement focused on observability (logging, artifact capture).

## Required Failure Analysis Fields

### A) Root Cause Statement (1 sentence)

Concrete, not generic:

- Bad: “Something failed in execution”
- Good: “Verifier failed because generated files were outside expected directory, violating repo structure rules.”

### B) Earliest Missed Signal

What could have caught it earlier:

- missing preflight check
- missing schema validation
- missing dependency availability check

### C) Responsibility Boundary

Where it should have been caught:

- orchestrator gate
- verifier
- executor
- planner/spec

### D) Retry Safety

- YES: safe to retry after applying prevention improvement
- NO: must revise spec/context before any retry
- UNKNOWN: must improve observability first

## Mandatory Failure Output Rules

On failure runs, Auditor must output:

- classification (not UNKNOWN unless justified)
- root cause (1 sentence)
- missed signal (1 bullet)
- one preventive chosenImprovement
- retrySafe (YES/NO/UNKNOWN)
- canClose must be `false` unless:
  - the run is considered “closed as failed” **and**
  - a follow-up task is created automatically

## Orchestrator Enforcement (Failure)

Orchestrator must:

- block retry if chosenImprovement missing
- block retry if classification missing
- auto-create a follow-up task using:
  - classification
  - root cause
  - chosenImprovement acceptanceCriteria

---

## Integration Points

### Where Auditor Sits in Agent Pipeline

- SUCCESS: Planner → Executor(s) → Verifier → **Auditor** → Close/Follow-up
- FAILURE: Planner → Executor(s) → (Verifier optional) → **Auditor** → Follow-up/Abort/Retry decision

### Orchestrator Responsibilities

- Provide Run Bundle
- Validate Auditor output schema
- Enforce “exactly one improvement”
- Persist outputs
- Create follow-up tasks automatically when required

---

## Persistence (Minimum)

Store Auditor output as a durable record per run:

- `runs/<runId>/auditor.json` (or equivalent)
- link it to task ID
- include it in an aggregated index:
  - “Top recurring frictions”
  - “Top recurring failure classifications”

(אם לא תשמור את זה איפשהו שניתן לנתח, אתה שוב בונה מערכת עם זיכרון של דג.)

---

## Acceptance Criteria (System-Level)

### Phase 1 (Success)

- Auditor runs on every success run
- Auditor produces valid structured output
- Exactly one improvement is selected
- Orchestrator blocks closure if output missing/invalid
- One repo-linked “whereItLives” present

### Phase 2 (Failure)

- Auditor runs on failure/aborted runs
- Must classify failure into Spec/Prompt, Context, Execution (or justified Unknown)
- Must produce a preventive improvement
- Orchestrator blocks retry without preventive improvement
- Follow-up task is generated with acceptance criteria

---

## Risks & Guardrails

### Risk: Improvement Becomes Fluffy Text

Guardrail:

- schema + strict limits (one improvement, max bullets)
- `whereItLives` must be concrete

### Risk: Too Much Process Overhead

Guardrail:

- enforce “ONE improvement”
- keep processDelta short

### Risk: Orchestrator Ignores Auditor

Guardrail:

- hard gate: no close without Auditor output

---

## Recommended Docs to Prepare

Based on size/risk, do this:

1. **High-Level Spec (HLS)** — mandatory (this doc is close, but still missing some concrete storage + schema validation decisions)
2. **Low-Level Plan (LLP)** — recommended (orchestrator integration + persistence + follow-up creation mechanics)
3. **PRD** — optional (only if you want stakeholder-level framing; not required for pure infra/process)

---

## Spec Progress Score (SPS): 86/100

- Decision coverage: high (+)
- Execution readiness: medium-high (needs explicit persistence location + schema validator details) (-)
- Open questions: a few (-)
- Reality alignment: high (+)

---
