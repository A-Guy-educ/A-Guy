# OpenCode Pipeline

Automated development pipeline for A-Guy project using OpenCode CLI agents.

## Pipeline Stages

```
Spec Phase:    taskify → [gate: hard-stop] → spec → [clarify: opt-in]
Impl Phase:    architect → plan-gap → build(+TDD) → commit(scripted) →
                verify(scripted) → auditor → apply-audit → pr(scripted)
```

**Clarify is opt-in** — use `--clarify` flag to enable Q&A loop (default: skip).

**Control modes** — Auto (low risk), Risk-Gated (medium risk), Hard Stop (high risk). See Control Modes section below.

**TDD via @test-writer** — build agent invokes test-writer subagent per plan step.

| Agent       | Description                        | Input                        | Output         | Type     |
| ----------- | ---------------------------------- | ---------------------------- | -------------- | -------- |
| taskify     | Classify task, produce task.json   | task.md                      | task.json      | agent    |
| spec        | Requirements definition            | task.md                      | spec.md        | agent    |
| clarify     | Collect operator Q&A (opt-in)      | task.md, spec.md             | questions.md   | agent    |
| architect   | Implementation plan                | spec.md, clarified.md        | plan.md        | agent    |
| plan-gap    | Analyze plan for gaps, auto-revise | spec.md, plan.md, task.json  | plan-gap.md    | agent    |
| build       | Write implementation code + tests  | spec.md, plan.md             | build.md       | agent    |
| commit      | Commit and push changes            | task.json                    | commit.md      | scripted |
| verify      | Run quality gates (tsc, lint, fmt) | code                         | verify.md      | scripted |
| autofix     | Fix lint/type/format errors        | verify.md                    | autofix.md     | agent    |
| auditor     | Process improvement analysis       | task.md, build.md, verify.md | auditor.md     | agent    |
| apply-audit | Implement auditor suggestions      | auditor.md                   | apply-audit.md | agent    |
| pr          | Create pull request via gh CLI     | task files                   | pr.md          | scripted |

### Stage Types

- **agent**: Runs via LLM agent (opencode github run)
- **scripted**: Runs directly via script (no LLM needed, faster)

### Model Routing

Not all stages need an expensive model. Lightweight stages use a faster/cheaper model:

| Model            | Used For                           | Cost    |
| ---------------- | ---------------------------------- | ------- |
| MiniMax-M2.5     | architect, build                   | Default |
| Gemini 2.5 Flash | plan-gap, commit, auditor, autofix | Fast    |

Override with `OPENCODE_MODEL` env var to force a specific model for all stages.

## Key Design Decisions

### Clarify Opt-In

The clarify stage is **opt-in** via `--clarify` flag. By default:

- Pipeline auto-creates `clarified.md` with "Use recommended answers."
- No Q&A loop, fully automated

Use `--clarify` when you want human review of ambiguities.

### TDD via @test-writer Subagent

The build agent invokes the `@test-writer` subagent for each plan step:

1. test-writer writes failing tests (TDD red)
2. build implements code to make tests pass (TDD green)
3. Run `pnpm test:unit` to verify

This removes the separate `test` LLM stage while maintaining test coverage.

### Build / Commit Split

The `build` agent writes code but does NOT commit or push. A separate scripted `commit` stage handles git operations. This means:

- If commit fails (commitlint), only the 3-minute scripted commit stage reruns (not the 30-minute build)
- Build agent focuses solely on code quality
- Commit stage uses conventional commit format automatically derived from task.json and task.md

### Plan Gap Analysis

The `plan-gap` agent runs after `architect` and before `build`. It analyzes the plan against the spec and codebase to identify:

- Missing spec requirements in the plan
- Wrong file paths or incorrect patterns
- Overlooked constraints or test gates

**If gaps are found**, the agent:

1. **Edits plan.md directly** to fix gaps (adds missing steps, corrects paths)
2. Writes `plan-gap.md` documenting what was found and changed

**No retry loop** — the gap agent fixes the plan in one pass and proceeds to build.

### Control Modes (Autonomy Levels)

The pipeline supports three autonomy levels based on task risk:

| Mode       | Trigger              | Gate Points                     | Use Case                          |
| ---------- | -------------------- | ------------------------------- | --------------------------------- |
| Auto       | `risk_level: low`    | None                            | Bug fixes, docs, low-risk changes |
| Risk-Gated | `risk_level: medium` | After architect                 | New features, refactors           |
| Hard Stop  | `risk_level: high`   | After taskify + after architect | DB changes, security, billing     |

**How it works:**

- **Auto mode** — Agent executes fully and opens PR. Used for low-risk, non-breaking changes.
- **Risk-Gated mode** — Agent pauses after `architect` (shows plan). User must approve before `build` runs.
- **Hard Stop mode** — Agent pauses immediately after `taskify` (before spec/architect). Mandatory human approval.

**Risk classification** comes from `task.json.risk_level` (produced by taskify agent):

- `low` → Auto
- `medium` → Risk-Gated
- `high` → Hard Stop

**Overriding control mode:**

- `/cody --auto` — Force auto mode (skip all gates)
- `/cody --gate` — Force risk-gated mode
- `/cody --hard-stop` — Force hard-stop mode

**Approving gated tasks:**

- `/cody approve` — Approve and resume pipeline
- `/cody reject` — Cancel the task

### Auto-Fix Loop

When `verify` fails, the pipeline doesn't immediately abort. Instead:

1. Run `autofix` agent with the verify error report
2. Re-run `verify` (scripted)
3. If still failing, retry once more (max 2 attempts)
4. If all attempts exhausted, pipeline fails

### Apply-Audit Stage

After auditor writes `auditor.md`, the `apply-audit` agent:

1. Reads the `## Chosen Improvement` section
2. Edits the file specified in `Where:` field
3. Changes are included in the same PR for human review

This automates process improvements instead of creating orphan markdown files.

### Stage-Specific Context (No .context.md)

Each agent receives only the files it needs via `STAGE_CONTEXT_FILES` in `stage-prompts.ts`.
There is no monolithic `.context.md` file. This means:

- Agents don't get confused by irrelevant prior outputs
- Context window is used efficiently
- The prompt lists exact file paths to read

### Prompt Architecture

Each agent has **two prompt layers**:

1. **System prompt**: `.opencode/agents/<stage>.md` — behavioral instructions, output format, rules
2. **User prompt**: `buildStagePrompt()` in `stage-prompts.ts` — runtime context only (task ID, file paths, spec-only guard)

The user prompt is intentionally minimal. Behavioral instructions live exclusively in the `.md` file.

### Content Validation

Stage outputs are validated after completion:

- **taskify**: JSON schema validation + normalization (aliases, types)
- **plan-gap**: Gap analysis + auto-revision
- **spec**: Warning if missing Requirements or Acceptance Criteria sections
- **build**: Warning if missing Changes section
- **verify**: Full error parsing + auto-fix loop

## Task Types & Pipelines

| Task Type | Pipeline                                                                           |
| --------- | ---------------------------------------------------------------------------------- |
| feat      | spec → architect → plan-gap → build → commit → verify → auditor → apply-audit → pr |
| fix       | spec → architect → plan-gap → build → commit → verify → auditor → apply-audit → pr |
| refactor  | spec → architect → plan-gap → build → commit → verify → auditor → apply-audit → pr |
| docs      | build → commit → auditor → apply-audit → pr                                        |

## Task Structure

```
.tasks/
└── <YYMMDD-task-name>/
    ├── task.md           # PRD/requirements (YOU write this)
    ├── task.json         # Task classification (taskify agent)
    ├── spec.md           # Detailed spec (spec agent)
    ├── questions.md      # Clarification questions (clarify agent, opt-in)
    ├── clarified.md      # Q&A answers (operator provides) or "Use recommended answers."
    ├── plan.md           # Implementation plan (architect agent)
    ├── plan-gap.md       # Gap analysis report (plan-gap agent)
    ├── build.md          # Build report + test summary (build agent)
    ├── commit.md         # Commit report (commit — scripted)
    ├── verify.md         # Verification results (verify — scripted)
    ├── autofix.md        # Auto-fix report (autofix agent, if verify fails)
    ├── auditor.md        # Process improvement (auditor agent)
    ├── apply-audit.md   # Applied audit (apply-audit agent)
    ├── pr.md             # PR summary (pr — scripted)
    └── status.json       # Pipeline status tracking
```

## Running the Pipeline

### Via GitHub Issue Comment

```
/cody                              # Full pipeline, auto-generate task-id
/cody --clarify                    # Full pipeline with clarify stage enabled
/cody fix the tests                # Rerun if artifacts exist, else full (auto-discovers task-id)
/cody update branch and fix lint   # Same as above, feedback = "update branch and fix lint"
/cody spec 260217-user-metrics     # Run spec phase only
/cody impl 260217-user-metrics     # Run impl phase only
/cody rerun 260217-user-metrics --feedback "fix this"
/cody status 260217-user-metrics   # Check pipeline status
```

**Simplified syntax**: When you use an unrecognized subcommand (like `/cody fix the tests`), the pipeline:

1. Auto-discovers the task-id from the issue's marker comment
2. If spec.md exists → reruns from build with your text as feedback
3. If no spec.md → runs full pipeline

### Via GitHub Workflow Dispatch

- `task_id`: Required
- `mode`: spec, impl, rerun, full, status (default: full)
- `clarify`: true/false (default: false) — enable clarify stage
- `dry_run`: true/false (default: false)

### Via Local CLI

```bash
pnpm cody:run --task-id=260217-user-metrics --mode=full --local
pnpm cody:run --task-id=260217-user-metrics --mode=full --clarify --local
pnpm cody:run --task-id=260217-user-metrics --mode=impl --local
pnpm cody:run --task-id=260217-user-metrics --mode=rerun --from=build --feedback="fix this" --local
```

## Commit Format

Conventional commits required:

```
<type>(<scope>): <Subject in sentence case>

<Body with at least 20 characters>
```

### Valid Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Restructuring
- `perf` - Performance
- `test` - Testing
- `build` - Build system
- `ci` - CI/CD
- `chore` - Maintenance
- `security` - Security

## Branch Naming

- `feat/<task-name>` - Features
- `fix/<task-name>` - Bug fixes
- `chore/<task-name>` - Maintenance
- `refactor/<task-name>` - Refactoring
- `docs/<task-name>` - Documentation
