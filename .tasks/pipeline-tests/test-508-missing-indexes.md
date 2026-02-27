# Pipeline Test: Issue #508 — Missing indexes on status and relationship fields

## Issue
- **Number**: 508
- **Title**: [MEDIUM] Performance: Missing indexes on status and relationship fields
- **Risk**: MEDIUM
- **Type**: Enhancement / Performance
- **Domain**: Backend / Database

## Run Command
```bash
nohup pnpm tsx scripts/cody/entry.ts \
  --task-id 260226-add-missing-indexes \
  --mode full --issue-number 508 \
  --local --auto \
  > /tmp/cody-508.log 2>&1 &
```

## What to Expect
- **Profile**: standard (enhancement, medium risk)
- **Key change**: Add `index: true` to ~10 field definitions across 7 files
- **Files**:
  - `src/server/payload/collections/Courses.ts` — status field
  - `src/server/payload/collections/Chapters.ts` — status field
  - `src/server/payload/collections/Lessons.ts` — status field
  - `src/server/payload/collections/Tenants.ts` — status field
  - `src/server/payload/collections/Posts/index.ts` — authors, categories
  - `src/server/payload/collections/Exercises/index.ts` — sourceDoc
  - `src/server/payload/collections/ConfigAuditLogs.ts` — tenant
  - `src/server/payload/collections/GuestSessions.ts` — claimedByUser
- **Stages**: taskify → spec → gap → architect → plan-gap → build → commit → [verify ‖ auditor] → apply-audit → pr

## Validation
- Pipeline handles many-file, small-change-per-file pattern
- `pnpm generate:types` should be run (schema changes)
- `tsc --noEmit` must pass
- No functional behavior change — purely additive

## Why This Tests
- Many files touched (7-8) with small changes each
- Tests build agent's discipline to not over-engineer
- Enhancement type — tests profile classification
- Schema change — tests whether pipeline runs generate:types
