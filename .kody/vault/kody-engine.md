---
title: Kody Engine
type: component
updated: 2026-05-04
sources:
  - https://github.com/A-Guy-educ/A-Guy/pull/1384
---

## Overview

Kody is the project's long-term memory / autonomous agent system. It posts comments on GitHub Issues using `@kody` slash-command syntax and maintains state via HTML-comment-wrapped JSON blocks in those comments.

## State Block Format

State is stored as inline HTML comments in issue comments:

```
<!-- kody:state:v1:begin -->
```json
{ "core": { "phase": "...", "status": "..." }, "flow": { "name": "...", "step": "..." } }
```
<!-- kody:state:v1:end -->
```

- `parseKodyState()` — two-pass fence stripper: first strips ````json` fences, then ```` fences, then `JSON.parse`s the result.
- State is read from the **latest** `@kody bug` cycle only — `getLatestBugFlowState()` filters state comments to those posted at or after the latest `@kody bug` timestamp to guard against stale cycles.

## Flow Lifecycle

- `classify` — initial triage (label fast path)
- `classify` postflight: `audit → state CREATE → @kody bug` (last)
- `bug` orchestrator starts; dispatches `@kody plan`
- **Race condition (v0.3.48 fix)**: without the fix, `@kody bug` run was cancelled by concurrency cull before the orchestrator started, causing engine to log "no action for event issue_comment" — `@kody plan` comment never posted.

## Integration Test Patterns

Smoke tests live in `tests/int/kody-classify-bug-dispatch.int.spec.ts`:

- `describe.skipIf(!process.env.GITHUB_TOKEN)` guard — skips when `GITHUB_TOKEN` is absent (matches `health.api.int.spec.ts` / `memory-system.int.spec.ts` patterns).
- `require('child_process')` is called **inside** the `gh()` helper closure to avoid `vi.mock('child_process')` conflicts with sibling unit test files.
- GH_TOKEN injected via `env` option: `env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN }` — mirrors `scripts/inspector/clients/github.ts` line 23.

## Related

- [admin-dashboard](./admin-dashboard.md) — kody runs within the admin context
