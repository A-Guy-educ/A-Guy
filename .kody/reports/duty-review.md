# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

## Cycle 1 — 1 healthy, 0 warn, 2 broken of 24 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | state.json never created; history shows 2 commits to duty body but 0 to state; duty cannot track per-PR state across ticks |
| architecture-audit | cto | 7d (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| ceo-performance-review | ceo | 7d | broken | state.json never created; report exists so duty ran, but promised state file was never persisted |
| cleanup-branches | coo | manual | pending | not yet reviewed |
| clear-empty-goals | — | 1d | pending | not yet reviewed |
| coverage-floor | kody | 1d (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| dead-code-sweep | kody | — (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| dependency-bump | kody | — (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| design-review | ux-designer | 7d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| docs-code | tech-writer | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| docs-readme | tech-writer | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| flaky-test-quarantine | kody | 1d (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| health-check | kody | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| job-gap-scan | ceo | — | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| pr-health-triage | cto | 15m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| publish-release | cto | manual | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| qa | qa | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| qa-sweep | qa | 1d | broken | lastRunISO frozen at 2026-05-23; history shows rev 3→12 May 22-23 then complete silence; cursor idle with no open issue — duty completed cleanly but engine stopped invoking it 5 days ago |
| qa-verify | qa | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| redispatch | kody | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| security-audit | cto | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| system-audit | coo | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| task-memory-extractor | coo | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| type-debt | kody | — (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |

## This cycle

**qa-sweep** — _broken_

- **Goal clarity** — PASS: job states one concrete, checkable goal (periodic broad exploratory QA via qa-engineer with no scope, summarized to inbox).
- **Procedure achieves goal** — PASS: check tracking issue → dispatch qa-engineer → post inbox rec → close tracking issue. All steps reachable and produce the intended output.
- **Cadence guard** — PASS: every: 1d frontmatter; state has nextEligibleISO = lastRunISO + 24h; formula matches cadence.
- **State contract** — PASS: state schema documented with cursor, lastRunISO, openIssue, nextEligibleISO; state file exists with correct schema (version 1, rev 12).
- **One-action-max** — PASS: single issue action per tick (check → dispatch → rec → close, one path taken).
- **Idempotence** — PASS: checks for existing tracking issue before dispatching; no timestamp in body; in-flight sweep correctly stages via openIssue.
- **Allowed-commands vs Restrictions** — PASS: gh issue* commands listed; restrictions say issue actions only; no internal contradiction.
- **Observed behavior** — BROKEN: lastRunISO = 2026-05-23T00:39:21Z (5 days ago). History shows rev 3→12 across May 22-23 (active), then 0 commits since. Cursor = idle, openIssue = null — duty completed cleanly but engine stopped invoking it. The duty design is sound; the dispatch chain appears broken at the engine level.
