# PRIMARY AGENT PIPELINE (Operational State Machine)

This pipeline is written for the **PRIMARY DRIVER agent**.
The driver does not reason intuitively.
It follows this document mechanically.

Source of truth:

- Task file
- Spec file
- Plan output
- Git state
- Verify report

If any required artifact is missing or ambiguous — STOP.

---

## ARTIFACTS (Required Files)

- Task: `.opencode/tasks/<task-id>.md`
- Spec: `docs/specs/<task-id>.spec.md`
- Plan: referenced output from Plan agent
- Verify Report: last verify output (PASS/FAIL)

---

## STATE DETECTION (Evaluate Top → Down)

Evaluate states in this exact order.
The **first matching rule wins**.

---

### STATE 0 — NO TASK

Condition:

- No file exists at `.opencode/tasks/<task-id>.md`

Action:

- STOP
- Ask user to create a Task file

---

### BLOCKED — CLARIFICATION REQUIRED

Condition:

- Task objective is ambiguous
- Scope is unclear
- Success Definition is not testable
- Conflicting constraints exist

Action:

- STOP pipeline execution
- Ask clarifying questions
- Do NOT proceed to Spec
- Do NOT guess

Exit Condition:

- Task updated with answers
- Ambiguity resolved

---

### STATE 1 — TASK ONLY

Condition:

- Task exists
- Spec does NOT exist

Next Agent:

- `spec`

Instruction:

- Produce a spec strictly from the task
- Write only `docs/specs/<task-id>.spec.md`
- Do not write code
- Do not plan implementation

---

### STATE 2 — SPEC READY

Condition:

- Spec exists
- Plan does NOT exist

Next Agent:

- `plan`

Instruction:

- Produce an execution plan derived from the spec
- Reference spec requirements explicitly
- Do not write code
- Do not modify spec

---

### STATE 3 — BUILD

Condition:

- Spec exists
- Plan exists
- AND (no commits exist after plan OR returning from verify FAIL)

Next Agent:

- `build`

Instruction:

- Pull latest `dev`
- Create a new working branch from `dev` named: `<type>/<kebab-case>`
- Validate the branch name by running: `pnpm check:branch`
- All work must be done on this branch only
- Implement strictly according to spec + plan
- Commit and push changes
- You own Git (commit / push / branch management)
- You may consult subagents
- You MUST NOT change the spec
- You MUST NOT expand scope

Exit Condition:

- One or more commits pushed that address the plan or verify fix list

---

### STATE 4 — VERIFY

Condition:

- New commits exist since last verify
- OR no verify has been run yet

Next Agent:

- `verify`

Instruction:

- Run hard gate (lint/typecheck/tests/build)
- Run soft gate (spec compliance)
- Output PASS or FAIL with an ordered fix list
- Do not modify code
- Do not commit
- Do not open PRs

---

### STATE 5 — VERIFY FAILED → RETURN TO BUILD

Condition:

- Last verify result = FAIL

Action:

- **IMMEDIATE RETURN TO STATE 3 (BUILD)**

Rule:

- No transition to Spec or Plan is allowed automatically
- Fixes must be applied by Build only
- Scope must not change

---

### STATE 6 — DONE

Condition:

- Last verify result = PASS

Action:

- STOP
- Task is complete and merge-ready

---

## CRITICAL LOOP (NON-NEGOTIABLE)

STATE 3 (BUILD)
→ STATE 4 (VERIFY)
→ FAIL → STATE 3 (BUILD)
→ PASS → STATE 6 (DONE)

Verify never advances the pipeline.
Verify only blocks or releases.

---

## DRIVER RULES (ABSOLUTE)

- Only **one agent** runs at a time
- The driver never skips states
- The driver never changes artifacts owned by other stages
- Verify FAIL never reopens Spec or Plan automatically
- Spec or Plan changes require **explicit manual restart**
- Progress = artifacts + commits, not discussion

---

## PRIMARY DRIVER OUTPUT CONTRACT

Every driver/orchestrator run MUST output exactly:

- Current State
- Blocking Condition (if any)
- Next Agent to Run
- Exact Instruction to That Agent

No commentary. No alternatives.

---

## FAILURE HANDLING

If:

- An artifact is unclear
- Commands cannot be determined
- State cannot be classified

Then:

- STOP
- Report the missing or ambiguous input
- Do not guess
