# Pipeline Test: Issue #511 — streamMessage not wrapped in useCallback

## Issue
- **Number**: 511
- **Title**: [MEDIUM] Perf: streamMessage not wrapped in useCallback — causes unnecessary re-renders
- **Risk**: MEDIUM
- **Type**: Performance bug
- **Domain**: Frontend / React hooks

## Run Command
```bash
nohup pnpm tsx scripts/cody/entry.ts \
  --task-id 260226-fix-stream-message-callback \
  --mode full --issue-number 511 \
  --local --auto \
  > /tmp/cody-511.log 2>&1 &
```

## What to Expect
- **Profile**: standard (medium risk)
- **Key change**: Wrap `streamMessage` in `useCallback` with correct deps
- **File**: `src/ui/web/chat/hooks/useNotebookChat.ts` lines 446, 689
- **Stages**: taskify → spec → gap → architect → plan-gap → build → commit → [verify ‖ auditor] → apply-audit → pr

## Validation
- Pipeline should run full standard profile (all stages)
- spec and gap stages should run (medium risk = standard)
- Build agent must handle React hook dependency arrays correctly
- ESLint react-hooks/exhaustive-deps warning should be resolved

## Why This Tests
- MEDIUM risk — tests standard profile pipeline
- Frontend/React domain — tests build agent on hook patterns
- Dependency array complexity — tests code quality of generated changes
