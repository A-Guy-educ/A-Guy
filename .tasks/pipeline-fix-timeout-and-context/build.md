# Build Agent Report: pipeline-fix-timeout-and-context

## Changes

### 1. Increased fix stage timeout (`scripts/cody/stages/registry.ts`)

Changed fix stage timeout from 30 minutes to 45 minutes (line 164).

**Reasoning**: The fix stage was timing out on complex issues (e.g., issue #813 with 44 critical issues). The original build stage gets 45 minutes but fix stage only got 30 minutes. Since fixes often involve understanding the original code, the problem, AND implementing a solution, fixes can take longer than the original implementation.

### 2. Limited fix stage context to prioritize critical issues (`scripts/cody/stage-prompts.ts`)

Added guidance to the fix stage prompt to focus on critical/major issues when review.md lists many findings.

**Added text**:
```
IMPORTANT: If review.md lists many issues (dozens+), focus on the CRITICAL issues first, then MAJOR issues.
Do NOT try to fix every single issue — prioritize the most impactful ones.
The goal is to make the code substantially better, not perfectly bug-free.
```

**Reasoning**: The review agent was outputting inflated/very high issue counts (318/318/318 pattern), causing the fix agent to spend too much time trying to address all issues instead of focusing on what matters. This change instructs the fix agent to prioritize.

## Quality

- TypeScript: PASS (no errors in changed files)
- Lint: PASS (no errors in changed files)

## Deviations

None — plan followed exactly.
