# OpenCode Pipeline

Automated development pipeline for A-Guy project using OpenCode CLI agents.

## Pipeline Stages

```
Spec Phase:    taskify → spec → clarify
Impl Phase:    architect → plan-review → build → commit → test →
               verify (scripted) → [autofix → re-verify]* → [auditor, pr] (parallel)
```

\*Auto-fix loop runs up to 2 times if verify detects lint/type/format errors.

| Agent       | Description                        | Input            | Output         | Type     |
| ----------- | ---------------------------------- | ---------------- | -------------- | -------- |
| taskify     | Classify task, produce task.json   | task.md          | task.json      | agent    |
| spec        | Requirements definition            | task.md          | spec.md        | agent    |
| clarify     | Collect operator Q&A               | task.md, spec.md | questions.md   | agent    |
| architect   | Implementation plan                | clarified.md     | plan.md        | agent    |
| plan-review | Review plan against spec           | plan.md, spec.md | plan-review.md | agent    |
| build       | Write implementation code          | plan.md          | build.md       | agent    |
| commit      | Commit and push changes            | build output     | commit.md      | agent    |
| test        | Write E2E/integration tests        | build.md         | test.md        | agent    |
| verify      | Run quality gates (tsc, lint, fmt) | code             | verify.md      | scripted |
| autofix     | Fix lint/type/format errors        | verify.md        | autofix.md     | agent    |
| auditor     | Process improvement analysis       | verify.md        | auditor.md     | agent    |
| pr          | Create pull request via gh CLI     | all above        | pr.md          | scripted |

### Stage Types

- **agent**: Runs via LLM agent (opencode github run)
- **scripted**: Runs directly via script (no LLM needed, faster)

### Parallel Stages

The `auditor` and `pr` stages run **in parallel** since they are independent:

- `auditor` reviews code quality
- `pr` creates the pull request
  Neither depends on the other's output.

## Key Design Decisions

### Build / Commit Split

The `build` agent writes code but does NOT commit or push. A separate `commit` agent
handles git operations. This means:

- If commit format fails (commitlint), only the 3-minute commit agent reruns (not the 30-minute build)
- Build agent focuses solely on code quality
- Commit agent focuses solely on conventional commit formatting

### Plan Review Gate

The `plan-review` agent runs after `architect` and before `build`. It validates:

- All spec requirements are covered in the plan
- File paths referenced in the plan actually exist
- Implementation order is logical

If plan-review returns FAIL, the pipeline stops before the expensive build stage.

### Model Routing

Not all stages need an expensive model. Lightweight stages use a faster/cheaper model:

| Model            | Used For                              | Cost    |
| ---------------- | ------------------------------------- | ------- |
| MiniMax-M2.5     | architect, build, test                | Default |
| Gemini 2.5 Flash | plan-review, commit, auditor, autofix | Fast    |

Override with `OPENCODE_MODEL` env var to force a specific model for all stages.

### Auto-Fix Loop

When `verify` fails, the pipeline doesn't immediately abort. Instead:

1. Run `autofix` agent with the verify error report
2. Re-run `verify` (scripted)
3. If still failing, retry once more (max 2 attempts)
4. If all attempts exhausted, pipeline fails

This saves ~30 minutes vs a full rerun from `build` for trivial lint/type errors.

### Skip Build in Verify

The `verify` script (`pnpm verify`) supports `SKIP_BUILD=1` to skip the Next.js
production build step. The Cody pipeline sets this automatically since the scripted
verify stage only runs tsc + lint + format (no build needed).

## Task Types & Pipelines

| Task Type | Pipeline                                                                                  |
| --------- | ----------------------------------------------------------------------------------------- |
| feat      | spec → clarify → architect → plan-review → build → commit → test → verify → [auditor, pr] |
| fix       | clarify → architect → plan-review → build → commit → test → verify → [auditor, pr]        |
| refactor  | clarify → architect → plan-review → build → commit → test → verify → [auditor, pr]        |
| docs      | build → commit → auditor → pr                                                             |

## Task Structure

```
.tasks/
└── <YYMMDD-task-name>/
    ├── task.md           # PRD/requirements (YOU write this)
    ├── task.json         # Task classification (taskify agent)
    ├── spec.md           # Detailed spec (spec agent)
    ├── questions.md      # Clarification questions (clarify agent)
    ├── clarified.md      # Q&A answers (operator provides)
    ├── plan.md           # Implementation plan (architect agent)
    ├── plan-review.md    # Plan review verdict (plan-review agent)
    ├── build.md          # Build report (build agent)
    ├── commit.md         # Commit report (commit agent)
    ├── test.md           # Test report (test agent)
    ├── verify.md         # Verification results (verify — scripted)
    ├── autofix.md        # Auto-fix report (autofix agent, if verify fails)
    ├── auditor.md        # Process improvement (auditor agent)
    ├── pr.md             # PR summary (pr — scripted)
    ├── status.json       # Pipeline status tracking
    └── .context.md       # Aggregated context for agents (auto-generated)
```

## Running the Pipeline

### Via GitHub Issue Comment

```
/cody                              # Full pipeline, auto-generate task-id
/cody spec 260217-user-metrics     # Run spec phase only
/cody impl 260217-user-metrics     # Run impl phase only
/cody rerun 260217-user-metrics --feedback "fix TypeScript errors"
/cody status 260217-user-metrics   # Check pipeline status
```

### Via Local CLI

```bash
pnpm cody:run --task-id=260217-user-metrics --mode=full --local
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
