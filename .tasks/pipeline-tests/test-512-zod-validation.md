# Pipeline Test: Issue #512 — Missing Zod validation on conversion queue API endpoints

## Issue
- **Number**: 512
- **Title**: [MEDIUM] Security: Missing Zod validation on conversion queue API endpoints
- **Risk**: MEDIUM
- **Type**: Security bug
- **Domain**: Backend / API

## Run Command
```bash
nohup pnpm tsx scripts/cody/entry.ts \
  --task-id 260226-add-zod-validation \
  --mode full --issue-number 512 \
  --local --auto \
  > /tmp/cody-512.log 2>&1 &
```

## What to Expect
- **Profile**: standard (security, medium risk)
- **Key change**: Add Zod schemas to validate request bodies before destructuring
- **Files**:
  - `src/app/api/exercises/convert/queue/route.ts` — line 62
  - `src/app/api/exercises/convert/queue-v2/route.ts` — line 61
- **Stages**: taskify → spec → gap → architect → plan-gap → build → commit → [verify ‖ auditor] → apply-audit → pr

## Validation
- Pipeline runs full standard profile
- Auditor should flag this as security-relevant and verify the fix
- Zod schemas should be correct (string().min(1) for required, optional() for optional)
- Error handling for parse failures (400 response)
- `tsc --noEmit` must pass

## Why This Tests
- Security domain — auditor stage is critical here
- API endpoint changes — tests build agent on Next.js route handlers
- Needs new imports (zod) and error handling patterns
- Two related files — tests consistency across similar endpoints
