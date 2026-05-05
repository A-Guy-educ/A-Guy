---
title: Admin Dashboard Testing
type: convention
updated: 2026-05-05
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1376
  - https://github.com/A-Guy-educ/A-Guy/pull/1374
---

# Admin Dashboard Testing

## User Creation Pattern

When integration tests need admin users:

1. Create user with default fields (creation hook sets role to `student`)
2. Update the same user with `role: 'admin'` separately (update bypasses creation hooks)

```typescript
// Step 1: Create — hook sets role to 'student'
const user = await payload.create({
  collection: 'users',
  data: { email, name, password },
})

// Step 2: Update — bypasses hook, sets role to 'admin'
await payload.update({
  collection: 'users',
  where: { id: { equals: user.id } },
  data: { role: 'admin' },
})
```

This avoids slug uniqueness conflicts and role override issues when creation hooks and test requirements conflict.

## Slug Uniqueness in Repeated Tests

When tests run repeatedly, add unique suffixes to slugs:

```typescript
const uniqueSlug = `course-${Date.now()}`
const course1 = await payload.create({
  data: { slug: `${uniqueSlug}-first`, ... },
})
```

This prevents E11000 duplicate key errors between test runs.

## Local API vs HTTP Endpoints

Prefer Payload local API (`payload.find()`, `payload.create()`) over HTTP calls in integration tests:

- No URL resolution issues (Node.js fetch requires absolute URLs for HTTP)
- Faster execution
- Direct DB access enables verification of complex query logic

See: [integration-testing-conventions](../conventions/integration-testing-conventions.md)
