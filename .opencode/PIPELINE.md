# OpenCode Pipeline

Automated development pipeline for A-Guy project using OpenCode CLI agents.

## Pipeline Stages

```
spec → clarify → plan → build → test → verify → auditor → pr
```

| Agent   | Description                        | Input            | Output       |
| ------- | ---------------------------------- | ---------------- | ------------ |
| spec    | Requirements definition            | task.md          | spec.md      |
| clarify | Collect operator Q&A               | task.md, spec.md | questions.md |
| plan    | Architecture, implementation steps | clarified.md     | plan.md      |
| build   | Write implementation code          | plan.md          | build.md     |
| test    | Write E2E/integration tests        | build.md         | test.md      |
| verify  | Run tests, validate                | test.md          | verify.md    |
| auditor | Process improvement analysis       | verify.md        | auditor.md   |
| pr      | Create branch, commit, open PR     | all above        | pr.md        |

## Task Types & Pipelines

| Task Type        | Pipeline                                                     |
| ---------------- | ------------------------------------------------------------ |
| feat             | spec → clarify → plan → build → test → verify → auditor → pr |
| fix              | clarify → plan → build → test → verify → auditor → pr        |
| refactor         | clarify → plan → build → test → verify → auditor → pr        |
| security         | clarify → plan → build → test → verify → auditor → pr        |
| chore            | build → test → verify → auditor → pr                         |
| docs             | build → auditor → pr                                         |
| test             | build → test → verify → auditor → pr                         |
| auditor-followup | build → verify → pr                                          |

## Running the Pipeline

### Create Task File

Create `.tasks/<YYMMDD-task-name>/task.md` with your requirements:

```markdown
# Task: <task-id>

## Description

Brief description of what to build

## Requirements

- Requirement 1
- Requirement 2

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
```

### Run Agents by Task Type

#### feat (new feature)

```bash
ocode run --agent spec "Create spec for YYMMDD-task-name"
ocode run --agent clarify "Generate questions for YYMMDD-task-name"
# (operator answers in clarified.md)
ocode run --agent plan "Create plan for YYMMDD-task-name"
ocode run --agent build "Implement YYMMDD-task-name"
ocode run --agent test "Write tests for YYMMDD-task-name"
ocode run --agent verify "Verify tests for YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### fix (bug fix)

```bash
ocode run --agent clarify "Generate questions for YYMMDD-task-name"
# (operator answers in clarified.md)
ocode run --agent plan "Create plan for YYMMDD-task-name"
ocode run --agent build "Fix YYMMDD-task-name"
ocode run --agent test "Write tests for YYMMDD-task-name"
ocode run --agent verify "Verify fix for YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### refactor (restructure code)

```bash
ocode run --agent clarify "Generate questions for YYMMDD-task-name"
ocode run --agent plan "Create plan for YYMMDD-task-name"
ocode run --agent build "Refactor YYMMDD-task-name"
ocode run --agent test "Write tests for YYMMDD-task-name"
ocode run --agent verify "Verify refactor for YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### security (security fix)

```bash
ocode run --agent clarify "Generate questions for YYMMDD-task-name"
ocode run --agent plan "Create plan for YYMMDD-task-name"
ocode run --agent build "Fix security issue YYMMDD-task-name"
ocode run --agent test "Write tests for YYMMDD-task-name"
ocode run --agent verify "Verify security fix for YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### chore (maintenance)

```bash
ocode run --agent build "Perform chore YYMMDD-task-name"
ocode run --agent test "Write tests for YYMMDD-task-name"
ocode run --agent verify "Verify chore YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### docs (documentation)

```bash
ocode run --agent build "Write documentation for YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### test (add tests)

```bash
ocode run --agent build "Add tests for YYMMDD-task-name"
ocode run --agent test "Write tests for YYMMDD-task-name"
ocode run --agent verify "Verify tests for YYMMDD-task-name"
ocode run --agent auditor "Analyze YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

#### auditor-followup (follow-up on auditor feedback)

```bash
ocode run --agent build "Implement auditor feedback for YYMMDD-task-name"
ocode run --agent verify "Verify changes for YYMMDD-task-name"
ocode run --agent pr "Create PR for YYMMDD-task-name"
```

## Commit Format

Conventional commits required:

```
<type>(<scope>): <subject>

- Bullet 1
- Bullet 2
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
- `revert` - Revert
- `security` - Security

### Rules

- Type must be lowercase
- Subject must be sentence-case (first letter capitalized)
- Body lines under 100 characters

## Branch Naming

- `feat/<task-name>` - Features
- `fix/<task-name>` - Bug fixes
- `chore/<task-name>` - Maintenance
- `refactor/<task-name>` - Refactoring
- `docs/<task-name>` - Documentation

## Task Structure

```
.tasks/
└── <YYMMDD-task-name>/
    ├── task.md           # PRD/requirements (YOU write this)
    ├── clarified.md      # Q&A answers (operator provides)
    ├── spec.md           # Detailed spec (spec agent writes)
    ├── plan.md           # Implementation plan (plan agent writes)
    ├── build.md          # Build output (build agent writes)
    ├── test.md           # Test output (test agent writes)
    ├── verify.md         # Verification results (verify agent writes)
    ├── auditor.md        # Auditor analysis (auditor agent writes)
    └── pr.md             # PR summary (pr agent writes)
```

## Validation

Run commit validation before committing:

```bash
./scripts/validate-commit.sh .git/COMMIT_EDITMSG
```

## Troubleshooting

### Pre-commit checks fail

1. Run `pnpm lint:fix` to auto-fix issues
2. Run `./scripts/validate-commit.sh <commit-msg>` to check format

### Type checking fails

1. Check for TypeScript errors: `pnpm typecheck`
2. Fix errors before committing

### Push verification fails

1. Run `pnpm verify` locally
2. Fix any issues before pushing

## Notes

- Always use `git add -A` when committing (not specific files)
- Skip hooks with `SKIP_HOOKS=1` git commit if needed
- Use `--no-verify` for pre-push verification bypass (not recommended)
