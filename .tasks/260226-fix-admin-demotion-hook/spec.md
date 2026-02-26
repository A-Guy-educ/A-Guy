# Specification (promoted)

Skipped via input_quality — taskify determined spec is unnecessary.

## Requirements

# Task

## Issue Title

[HIGH] Bug: preventLastAdminDemotion uses overrideAccess: false for admin count
## Description
The `preventLastAdminDemotion` hook counts existing admins with `overrideAccess: false`. This means the count is filtered by the **current user's access control**. If a non-admin triggers this path, they can't see other admins, so `adminCount` returns 0 — incorrectly allowing the last admin to be demoted.

## Files Affected
- `src/server/payload/collections/Users/hooks/preventLastAdminDemotion-hook.ts` — line 27

## Current Code
```typescript
const { totalDocs: adminCount } = await req.payload.count({
  collection: 'users',
  where: {
    role: { equals: AccountRole.Admin },
  },
  overrideAccess: false, // ❌ Filtered by current user's access
  req,
})
```

## Expected Fix
```typescript
const { totalDocs: adminCount } = await req.payload.count({
  collection: 'users',
  where: {
    role: { equals: AccountRole.Admin },
  },
  overrideAccess: true, // ✅ System-level check needs full visibility
  req,
})
```

## Priority
HIGH — Security bug, could allow last admin demotion


## Acceptance Criteria

- [ ] Fix applied: change `overrideAccess: false` to `overrideAccess: true` on line 27
- [ ] TypeScript compilation passes
- [ ] Note: No unit tests exist for this hook - test criterion not applicable
