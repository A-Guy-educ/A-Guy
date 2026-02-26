# Skill: cody-local-exec

# Run Cody Locally with Markdown File

Use this skill when you want to run Cody on a local markdown file (containing PRD/requirements).

## How to Run

```bash
pnpm cody --file path/to/feature.md
```

## Options

| Flag        | Description                             | Example                 |
| ----------- | --------------------------------------- | ----------------------- |
| `--file`    | Path to markdown file with requirements | `--file prd.md`         |
| `--mode`    | Pipeline mode (default: full)           | `--mode spec`           |
| `--profile` | Profile: standard or lightweight        | `--profile lightweight` |
| `--clarify` | Enable clarify stage                    | `--clarify`             |

## Examples

### Full pipeline (default)

```bash
pnpm cody --file prd.md
```

### Spec only (generate spec, no implementation)

```bash
pnpm cody --file prd.md --mode spec
```

### Lightweight (skip gap analysis, auditor)

```bash
pnpm cody --file prd.md --profile lightweight
```

### With clarify stage (interactive clarification)

```bash
pnpm cody --file prd.md --clarify
```

## What Happens

1. Reads the markdown file
2. Creates `task.md` in `.tasks/<task-id>/`
3. Runs the pipeline
4. Creates a branch with changes
5. Opens a PR

## Task ID

Generated from filename:

- `prd.md` → `260226-prd`
- `feature-login.md` → `260226-feature-login`

---

**Base directory**: `file:///Users/aguy/projects/A-Guy-2/.agents/skills/cody-local-exec`
