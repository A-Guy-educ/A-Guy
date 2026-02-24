# Task

## Issue Title

[HIGH] Bug: Exercise hooks bypass transaction safety — use standalone getPayload() instead of req.payload
## Description
The `generateSlug` and `validateSlugUniqueness` hooks in the Exercises collection create a **standalone Payload instance** via `getPayload({ config })` instead of using `req.payload`. All `payload.find()` calls run outside the current request transaction, creating a race condition risk for slug uniqueness.

## Files Affected
- `src/server/payload/collections/Exercises/hooks.ts` — lines 5-9 (`getPayloadInstance`), 36, 77

## Current Code (broken)
```typescript
// Creates NEW instance — separate transaction
async function getPayloadInstance() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

// Line 36 — find() without req
const existing = await payload.find({
  collection: 'exercises',
  where: { ... },
  limit: 1,
  // ❌ Missing: req
})
```

## Expected Fix
Use `req.payload` from the hook context instead of creating a standalone instance:
```typescript
export const generateSlug: FieldHook = async ({ data, req, siblingData }) => {
  // Use req.payload instead of standalone instance
  const existing = await req.payload.find({
    collection: 'exercises',
    where: { ... },
    limit: 1,
    req, // Pass req for transaction safety
  })
}
```

## Risk
Race condition — if the exercise create/update transaction fails after slug generation, the slug uniqueness check ran in a separate connection and can't be rolled back.

## Priority
HIGH — Data integrity / transaction safety
