---
name: verify
description: Verification stage — runs quality gates directly. This is a SCRIPTED STAGE, not an LLM agent.
mode: primary
tools:
  bash: false
  read: false
  write: false
  edit: false
---

# DEPRECATED — this stage is now scripted

# VERIFY STAGE (Scripted)

**NOTE:** This stage runs as a script (`runVerifyStage()` in `scripted-stages.ts`), not as an LLM agent.
This file exists only for documentation.

The scripted verify stage runs quality gates directly:

1. **TypeScript**: `pnpm -s tsc --noEmit`
2. **Lint**: `pnpm -s lint`
3. **Format**: `pnpm -s format:check`
4. **Unit Tests**: `pnpm -s test:unit`

Each gate runs with a 2-minute timeout. Any failure = verification FAIL.

The stage outputs `.tasks/<task-id>/verify.md` with pass/fail status for each gate.

If any gate fails, the pipeline runs the `autofix` agent to attempt automatic corrections (up to 2 attempts).
