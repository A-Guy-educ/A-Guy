# OpenCode Pipeline

Automated development pipeline for A-Guy project using OpenCode CLI agents.

## Pipeline Stages

```
spec → clarify → plan → build → test → verify → auditor → pr
```

| Stage | Agent | Description | Input | Output |
|-------|-------|------------|-------|--------|
| 1 | spec | Requirements definition | task.md | spec.md |
| 2 | clarify | Collect operator Q&A | task.md, spec.md | questions.md |
| 3 | plan | Architecture, implementation steps | clarified.md | plan.md |
| 4 | build | Write implementation code | plan.md | build.md |
| 5 | test | Write E2E/integration tests | build.md | test.md |
| 6 | verify | Run tests, validate | test.md | verify.md |
| 7 | auditor | Process improvement analysis | verify.md | auditor.md |
| 8 | pr | Create branch, commit, open PR | all above | pr.md |

## Task Types & Pipelines

| Task Type | Pipeline |
|-----------|----------|
| feat | spec → clarify → plan → build → test → verify → auditor → pr |
| fix | clarify → plan → build → test → verify → auditor → pr |
| refactor | clarify → plan → build → test → verify → auditor → pr |
| security | clarify → plan → build → test → verify → auditor → pr |
| chore | build → test → verify → auditor → pr |
| docs | build → auditor → pr |
| test | build → test → verify → auditor → pr |
| auditor-followup | build → verify → pr |

## How to Provide Requirements

### Step 1: Create Task File
Create `.tasks/<YYMMDD-task-name>/task.md` with your PRD:

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

### Step 2: Run Spec Agent
```bash
ocode run --agent spec "Create spec for task 260214-seo-meta-tags"
# Reads: .tasks/260214-seo-meta-tags/task.md
# Writes: .tasks/260214-seo-meta-tags/spec.md
```

### Step 3: Run Clarify Agent
```bash
ocode run --agent clarify "Generate questions for task 260214-seo-meta-tags"
# Reads: task.md, spec.md
# Writes: questions.md
```

### Operator answers questions in questions.md → creates clarified.md

### Step 4: Continue Pipeline
```bash
ocode run --agent plan "Create plan for 260214-seo-meta-tags"
ocode run --agent build "Implement 260214-seo-meta-tags"
# ... continue with test, verify, auditor, pr
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
