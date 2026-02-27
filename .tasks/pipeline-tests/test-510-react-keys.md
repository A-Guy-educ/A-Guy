# Pipeline Test: Issue #510 — Chat messages use array index as React key

## Issue
- **Number**: 510
- **Title**: [MEDIUM] Bug: Chat messages use array index as React key
- **Risk**: MEDIUM
- **Type**: UI bug
- **Domain**: Frontend / React

## Run Command
```bash
nohup pnpm tsx scripts/cody/entry.ts \
  --task-id 260226-fix-react-keys \
  --mode full --issue-number 510 \
  --local --auto \
  > /tmp/cody-510.log 2>&1 &
```

## What to Expect
- **Profile**: standard (medium risk)
- **Key change**: Replace `key={idx}` with `key={msg.id}` and `key={post.slug || post.id}`
- **Files**:
  - `src/ui/web/chat/ChatInterface/index.tsx` lines 382, 395
  - `src/ui/web/CollectionArchive/index.tsx` line 20
- **Stages**: taskify → spec → gap → architect → plan-gap → build → commit → [verify ‖ auditor] → apply-audit → pr

## Validation
- Pipeline should run full standard profile
- Multi-file changes — tests build agent on cross-file edits
- TypeScript must still compile (msg.id, post.slug types must exist)
- No new lint warnings

## Why This Tests
- Multi-file change across 2 components
- Standard profile with all stages
- Tests build agent's ability to find correct stable IDs from types
