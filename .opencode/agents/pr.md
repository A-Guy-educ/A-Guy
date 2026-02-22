---
name: pr
description: PR creation — this is a SCRIPTED STAGE, not an LLM agent
mode: primary
tools:
  bash: true
  read: true
  write: false
  edit: false
---

# DEPRECATED — this stage is now scripted

# PR STAGE (Scripted)

**NOTE:** This stage runs as a script (`scripted-stages.ts`), not as an LLM agent.
This file exists only for documentation. The PR is created via `gh pr create` directly.

The scripted PR stage:

1. Checks for existing PR on the branch
2. Pushes the branch to remote
3. Builds PR title from task.md and task.json
4. Creates PR via `gh pr create` targeting the default branch
5. Writes `pr.md` with the PR URL
