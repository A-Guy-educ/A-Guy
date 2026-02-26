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
const adminCount = await req.payload.count({
  collection: 'users',
  where: { roles: { contains: 'admin' } },
  overrideAccess: false, // ❌ Filtered by current user's access
})
```

## Expected Fix
```typescript
const adminCount = await req.payload.count({
  collection: 'users',
  where: { roles: { contains: 'admin' } },
  overrideAccess: true, // ✅ System-level check needs full visibility
  req,
})
```

## Priority
HIGH — Security bug, could allow last admin demotion


## Acceptance Criteria

- [ ] Fix applied as described in task.md
- [ ] TypeScript compilation passes
- [ ] Unit tests pass
