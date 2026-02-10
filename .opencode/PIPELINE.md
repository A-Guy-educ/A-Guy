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

## IMPLEMENTATION

| Component       | Location                             |
| --------------- | ------------------------------------ |
| Pipeline script | `scripts/pipeline.ts`                |
| Agents          | `.opencode/agents/*.md`              |
| Config          | `scripts/pipeline.ts:DEFAULT_CONFIG` |

```bash
# Development
pnpm pipeline --task-id=<id>        # Detect state
pnpm pipeline --task-id=<id> --run   # Invoke agent
pnpm pipeline:run --task-id=<id>     # Full loop
```
