# Task

## Description
The slug generation hook uses a `while(true)` loop to find a unique slug by appending incrementing numbers. There is no upper bound — if thousands of exercises share the same title in a lesson, this runs unbounded queries.

## Files Affected
- `src/server/payload/collections/Exercises/hooks.ts` — lines 35-54

## Expected Fix
Add a safety limit:
```typescript
let counter = 1
const MAX_SLUG_ATTEMPTS = 100

while (counter <= MAX_SLUG_ATTEMPTS) {
  const existing = await req.payload.find({ ... })
  if (!existing.totalDocs) break
  counter++
}

if (counter > MAX_SLUG_ATTEMPTS) {
  throw new Error('Unable to generate unique slug after 100 attempts')
}
```

## Priority
MEDIUM — Edge case that could cause infinite loop under pathological data
