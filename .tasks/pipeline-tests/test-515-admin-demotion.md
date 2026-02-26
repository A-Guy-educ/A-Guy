# Pipeline Test: Issue #515 — preventLastAdminDemotion uses overrideAccess: false

## Issue
- **Number**: 515
- **Title**: [HIGH] Bug: preventLastAdminDemotion uses overrideAccess: false for admin count
- **Risk**: HIGH
- **Type**: Security bug
- **Domain**: Backend / Access Control

## Run Command
```bash
nohup pnpm tsx scripts/cody/entry.ts \
  --task-id 260226-fix-admin-demotion-hook \
  --mode full --issue-number 515 \
  --local --auto \
  > /tmp/cody-515.log 2>&1 &
```

## What to Expect
- **Profile**: lightweight (fix_bug, but HIGH risk → standard?)
- **Key change**: `overrideAccess: false` → `overrideAccess: true` in 1 file
- **File**: `src/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook.ts` line 27
- **Stages**: taskify → architect → build → commit → [verify ‖ auditor] → apply-audit → pr

## Validation
- Pipeline should complete all stages including auditor
- PR should be created on GitHub
- `tsc --noEmit` must pass
- Unit tests must pass

## Why This Tests
- HIGH risk security bug — tests risk classification
- Single-file, single-line fix — tests minimal change pipeline
- Access control domain — auditor should flag security implications
