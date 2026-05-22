---
title: Integration Testing Conventions
type: convention
updated: 2026-05-05
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1384
  - https://github.com/A-Guy-educ/A-Guy/pull/1376
  - https://github.com/A-Guy-educ/A-Guy/pull/1374
---

# Integration Testing Conventions

## Guard Pattern for Optional Dependencies

Use `describe.skipIf()` to conditionally skip tests when optional dependencies are unavailable:

```typescript
// Pattern for GitHub API tests (PR #1384)
describe.skipIf(!process.env.GITHUB_TOKEN)('kody-engine smoke test', () => { ... })

// Pattern for feature-flagged tests (from health.api.int.spec.ts)
describe.skipIf(!hasOpenAIKey)('Memory System Integration Tests', () => { ... })

// Pattern for Atlas vs local DB (from health.api.int.spec.ts)
describe.skipIf(isAtlasUrl)('GET /api/health', () => { ... })
```

## Payload Local API vs HTTP Endpoints

For integration tests, prefer Payload's local API over HTTP endpoints:

- HTTP calls require absolute URLs and are prone to Node.js fetch URL resolution issues
- Local API (`payload.create()`, `payload.find()`) is more reliable and faster for integration tests
- Direct DB queries are appropriate when verifying complex date-based logic

See: [admin-dashboard-testing](../testing/admin-dashboard-testing.md)

## User Creation in Integration Tests

When creating users with specific roles in integration tests:

1. Create the user first — hooks auto-assign default roles (e.g., `student`)
2. Update separately to set the target role — the update operation bypasses the creation hook

This avoids slug uniqueness conflicts and ensures the user has the correct role without fighting hook behavior.

See: [admin-dashboard-testing](../testing/admin-dashboard-testing.md)

## State Comment Parsing

Kody engine uses HTML-comment-wrapped JSON for state blocks:

```typescript
const parseKodyState = (text: string): KodyStateV1 | null => {
  const beginMarker = '<!-- kody:state:v1:begin -->'
  const endMarker = '<!-- kody:state:v1:end -->'
  // Extract between markers, strip ```json fences
}
```

## Timestamp Filtering for Stale Data

When multiple state cycles exist, filter to the latest cycle using timestamp comparison:

```typescript
const latestBugTime = bugComments[bugComments.length - 1].createdAt
const stateComments = comments.filter(c =>
  parseKodyState(c.body) !== null &&
  new Date(c.createdAt).getTime() >= new Date(latestBugTime).getTime()
)
```

See: [kody-integration-testing](../testing/kody-integration-testing.md)
