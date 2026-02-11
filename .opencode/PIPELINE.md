# PRIMARY AGENT PIPELINE (Operational State Machine)

This pipeline is implemented in `scripts/pipeline.ts`. It detects artifacts, resolves pipeline state, and can invoke OpenCode agents.

---

## INSTALLATION

### Required: OpenCode CLI

```bash
# Install globally
pnpm setup:opencode

# Or manually
curl -fsSL https://opencode.ai/install | bash

# Verify installation
~/.opencode/bin/opencode --version
```

### GitHub Actions (Linux x86_64)

Add to your workflow:

```yaml
- name: Install OpenCode CLI
  run: curl -L https://opencode.ai/install | sudo bash
```

Or use the provided workflow: `.github/workflows/pipeline.yml`

---

## CLI USAGE

```bash
# Read-only state detection
pnpm pipeline --task-id=<id>
pnpm pipeline --task-id=<id> --format=json

# List all tasks
pnpm pipeline --list

# Watch mode for continuous monitoring
pnpm pipeline --task-id=<id> --watch

# Run agent for current state
pnpm pipeline --task-id=<id> --run

# Run BUILD-VERIFY loop
pnpm pipeline:run --task-id=<id>
```

---

## STATE MACHINE (Top-Down)

| State        | Condition                                               | Next Agent |
| ------------ | ------------------------------------------------------- | ---------- |
| `NO_TASK`    | No task directory                                       | none       |
| `TASK_ONLY`  | Task exists, no spec                                    | `spec`     |
| `SPEC_READY` | Spec exists, no plan                                    | `plan`     |
| `BUILD`      | Plan exists, no verify OR verify fail OR no new commits | `build`    |
| `VERIFY`     | Verify exists, new commits since verify                 | `verify`   |
| `DONE`       | Verify PASS/COMPLIANT                                   | none       |

---

## ARTIFACTS (`.tasks/<task-id>/`)

```
.tasks/<task-id>/
  {task.md,prd.md,hls.md,llp.md,gap.md}  → Task definition
  spec.md                                 → Requirements
  plan.md                                 → Implementation steps
  verify-YYYYMMDD-HHMMSS.md               → Verification report
```

---

## AGENTS (`.opencode/agents/`)

| Agent              | File                  | Purpose                      |
| ------------------ | --------------------- | ---------------------------- |
| `spec`             | `spec.md`             | Write requirements spec      |
| `plan`             | `plan.md`             | Create implementation plan   |
| `build`            | `build.md`            | Implement & commit           |
| `verify`           | `verify.md`           | Run gates, output PASS/FAIL  |
| `auditor`          | `auditor.md`          | Process improvement analysis |
| `advisor`          | `advisor.md`          | Strategic advisor (subagent) |
| `code-reviewer`    | `code-reviewer.md`    | Code quality (subagent)      |
| `security-auditor` | `security-auditor.md` | Security review (subagent)   |
| `payload-expert`   | `payload-expert.md`   | Payload CMS (subagent)       |

---

## PHASE 1: State Detection

Runs without agent invocation. Outputs:

```markdown
# Pipeline State Report

## Overview

| Property          | Value      |
| ----------------- | ---------- |
| **Task ID**       | `<id>`     |
| **Current State** | `🔨 BUILD` |
| **Next Agent**    | `build`    |

## Artifacts

| Artifact | Status |
| -------- | ------ |
| spec.md  | ✅     |
| plan.md  | ✅     |

## Git State

| Property                 | Value         |
| ------------------------ | ------------- |
| **Branch**               | `feature/xxx` |
| **Commits Since Verify** | 5             |
```

---

## PHASE 2: Git State Detection

Automatically detected:

- `currentBranch` - `git rev-parse --abbrev-ref HEAD`
- `lastCommitHash` - `git rev-parse HEAD`
- `hasUncommittedChanges` - `git status --porcelain`
- `commitsSinceVerify` - count commits since verify report

**VERIFY triggers when:**

- Verify report exists
- Final result = FAIL or COMPLIANT
- New commits since verify

---

## PHASE 3: Agent Invocation

Invoked via `--run` or `pipeline:run`:

1. Detect current state
2. Get agent from state config
3. Create task context (reads task/spec/plan)
4. Invoke: `npx opencode --agent <agent-file> --project <cwd>`
5. Agent writes to artifacts
6. Re-evaluate state

**Requirements:**

- OpenCode CLI installed: `npm install -g @opencode-ai/cli`
- Agent files in `.opencode/agents/`

**Loop (BUILD-VERIFY):**

```
BUILD → (new commits) → VERIFY → FAIL → BUILD
                               ↓ PASS → DONE
Max iterations: 5 (configurable)
```

---

## STATE 4b — VERIFY FAILED → AUDIT

Condition:

- Last verify result = FAIL
- AND no auditor output exists for the current run yet

Next Agent:

- `auditor`

Instruction:

- Analyze the failed run
- Classify the failure (SPEC_PROMPT / CONTEXT / EXECUTION / UNKNOWN)
- Produce one preventive improvement
- Write output to `.tasks/<task-id>/runs/<run-id>/auditor.json`
- Auditor must set `retrySafe` field
- Do not modify code

Post-audit:

- If `retrySafe = YES` → return to STATE 3 (BUILD)
- If `retrySafe = NO` → STOP, manual intervention required
- If `retrySafe = UNKNOWN` → STOP, improve observability first

---

## STATE 5 — AUDIT

Condition:

- Last verify result = PASS
- AND (no auditor output exists for current run OR auditor output has `canClose = false`)

Next Agent:

- `auditor`

Instruction:

- Analyze the full run (spec, plan, build diffs, verify report)
- Produce exactly one process improvement
- Write output to `.tasks/<task-id>/runs/<run-id>/auditor.json`
- Output must conform to AuditorOutput schema
- Do not modify code
- Do not commit

---

## STATE 5b — AUDIT FAILED → MANUAL INTERVENTION

Condition:

- Auditor output exists but `canClose = false`
- OR Auditor output schema validation failed

Action:

- STOP pipeline execution
- Report: "Auditor gate blocked closure. Reason: [canClose=false | schema invalid]"
- Follow-up task must be created before pipeline can close

---

## STATE 6 — DONE

Condition:

- Last verify result = PASS
- AND auditor output exists for current run
- AND auditor output `canClose = true`
- AND auditor output schema is valid

Action:

- STOP
- Task is complete and merge-ready

---

## CRITICAL LOOP (NON-NEGOTIABLE)

STATE 3 (BUILD)
→ STATE 4 (VERIFY)
→ FAIL → STATE 4b (AUDIT)
→ retrySafe=YES → STATE 3 (BUILD)
→ retrySafe=NO/UNKNOWN → MANUAL INTERVENTION
→ PASS → STATE 5 (AUDIT)
→ canClose=true → STATE 6 (DONE)
→ canClose=false → MANUAL INTERVENTION

Verify never advances the pipeline.
Verify only blocks or releases.
Audit always runs before DONE.
Audit blocks closure if canClose=false.

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
- Run ID: (if in AUDIT or post-AUDIT state)

No commentary. No alternatives.

---

## DRIVER OUTPUT CONTRACT

```typescript
interface DriverOutput {
  currentState: PipelineState
  blockingCondition: string | null
  nextAgent: string | null
  instruction: string | null
  artifacts: {
    taskId: string
    specFileExists: boolean
    planFileExists: boolean
    latestVerify: VerifyReportSummary | null
    gitState: GitStateSummary | null
  }
}
```

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

---

## IMPLEMENTATION

| Component       | Location                             |
| --------------- | ------------------------------------ |
| Pipeline script | `scripts/pipeline.ts`                |
| Agents          | `.opencode/agents/*.md`              |
| Config          | `scripts/pipeline.ts:DEFAULT_CONFIG` |

---

## DEVELOPMENT

```bash
# Development
pnpm pipeline --task-id=<id>        # Detect state
pnpm pipeline --task-id=<id> --run   # Invoke agent
pnpm pipeline:run --task-id=<id>     # Full loop
```
