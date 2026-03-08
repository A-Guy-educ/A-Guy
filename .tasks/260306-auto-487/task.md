# Task

## Issue Title

Security: ExerciseAssets collection allows any authenticated user to delete/update any asset
## Description

The `ExerciseAssets` collection uses `authenticated` for `create`, `delete`, and `update` access control. This means **any logged-in student can delete or modify any exercise asset** in the system, including those belonging to other users' exercises or admin-uploaded content.

Compare with `ChatAssets` which properly restricts all mutations to server-only (`() => false`).

## Current Behavior

```typescript
// ExerciseAssets.ts
access: {
  create: authenticated,  // Any logged-in user
  delete: authenticated,  // Any logged-in user can delete ANY asset
  update: authenticated,  // Any logged-in user can update ANY asset
  read: anyone,
}
```

## Expected Behavior

```typescript
access: {
  create: authenticated,  // Keep: users can create via conversion
  delete: adminOnly,      // Fix: only admins can delete
  update: adminOnly,      // Fix: only admins can update
  read: anyone,
}
```

Or implement `isAdminOrOwner` pattern similar to the Exercises collection if user-owned asset management is needed.

## Files to Change

- `src/server/payload/collections/ExerciseAssets.ts`

## Complexity

Medium — single file access control change, but requires understanding the access control patterns and testing that the conversion pipeline still works (it uses `overrideAccess: true` internally).

## Labels

security, bug
