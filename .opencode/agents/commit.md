---
name: commit
description: Commit stage — runs as a scripted stage, not an LLM agent
mode: primary
tools:
  bash: false
  read: false
  write: false
  edit: false
---

# DEPRECATED — this stage is now scripted

# COMMIT STAGE (Scripted)

**NOTE:** This stage runs as a script (`runCommitStage()` in `scripted-stages.ts`), not as an LLM agent.
This file exists only for documentation.

The scripted commit stage:

1. Reads `task.json` → derives commit type (`implement_feature` → `feat`, `fix_bug` → `fix`, etc.)
2. Reads `task.md` → extracts first line as commit subject
3. Reads `build.md` → extracts ## Changes section as commit body
4. Runs: `git add -A && git commit -m "<type>(<taskId>): <subject>\n\n<body>" && git push -u origin HEAD`
5. Writes `commit.md` with branch name, commit hash, push status

Falls back gracefully: if `task.md` missing, uses "implement changes"; if `build.md` missing, uses generic body.
