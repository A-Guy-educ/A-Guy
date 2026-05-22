---
title: Kody Integration Testing
type: convention
updated: 2026-05-05
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1384
---

# Kody Integration Testing

## Test Structure

Kody engine smoke tests verify end-to-end GitHub event handling by inspecting comments and state blocks on live issues.

## Avoiding Mock Conflicts

When a sibling unit test file uses `vi.mock('child_process')`, integration tests using the `gh` CLI must avoid that mock:

```typescript
// WRONG: Module-level import causes vi.mock conflicts
import { execFileSync } from 'child_process'

// CORRECT: Require inside the gh() closure (PR #1384)
const gh = (args: string[]): string => {
  const { execFileSync } = require('child_process')
  return execFileSync('gh', args, { ... })
}
```

Pass `GH_TOKEN` via `env` option to `execFileSync`, matching `scripts/inspector/clients/github.ts`.

## GitHub Token Guards

Use `describe.skipIf(!process.env.GITHUB_TOKEN)` at the describe level to skip when credentials are unavailable. This pattern matches `health.api.int.spec.ts` and `memory-system.int.spec.ts`.

## State Block Format

Kody engine posts state as HTML-comment-wrapped JSON:

```
<!-- kody:state:v1:begin -->
```json
{"core":{"phase":"idle","status":"pending"},...}
```
<!-- kody:state:v1:end -->
```

Parsing requires two-pass fence stripping (strip ` ```json` opening, then ` ``` ` closing).

## Regression Gates

For race-condition fixes, include a regression gate test that asserts the presence of an expected downstream comment. If the fix reverts, the downstream comment is absent and the test fails.

## Related

- [integration-testing-conventions](../conventions/integration-testing-conventions.md)
