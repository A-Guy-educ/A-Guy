# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

## Cycle 2 — 1 healthy, 0 warn, 3 broken of 24 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | state.json never created; history shows 2 commits to duty body but 0 to state; duty cannot track per-PR state across ticks |
| architecture-audit | cto | 7d (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| ceo-performance-review | ceo | 7d | broken | state.json never created; report exists so duty ran, but promised state file was never persisted |
| cleanup-branches | coo | manual | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| clear-empty-goals | — | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| coverage-floor | kody | 1d (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| dead-code-sweep | kody | — (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| dependency-bump | kody | — (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| design-review | ux-designer | 7d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| docs-code | tech-writer | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| docs-readme | tech-writer | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| flaky-test-quarantine | kody | 1d (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| health-check | kody | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| job-gap-scan | ceo | 1d | broken | state persisted to .kody/jobs/ (old location) while body says .kody/jobs/; migration commit moved file to .kody/duties/ but script still writes to legacy path; two non-identical state files exist |
| pr-health-triage | cto | 15m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| publish-release | cto | manual | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| qa | qa | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| qa-sweep | qa | 1d | broken | lastRunISO frozen at 2026-05-23; history shows rev 3→12 May 22-23 then complete silence; cursor idle with no open issue — duty completed cleanly but engine stopped invoking it 5 days ago |
| qa-verify | qa | 30m | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO, data.nextEligibleISO never persisted |
| redispatch | kody | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| security-audit | cto | 1d | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| system-audit | coo | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| task-memory-extractor | coo | 30m | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |
| type-debt | kody | — (disabled) | healthy | not reviewed this cycle; design reviewed in prior tick — passes every check |

## This cycle

**qa-verify** — _broken_

- **Goal clarity** — PASS: job states one concrete, checkable goal (dispatch ui-review on delivery PRs, route merge/fix recommendations based on verdict).
- **Procedure achieves goal** — PASS: step 1 handles in-flight review verdict (PASS/CONCERNS/FAIL), step 2 picks oldest delivery PR and dispatches ui-review. Both paths produce intended output (inbox rec or merge/fix action).
- **Cadence guard** — WARN: every: 30m frontmatter present but no state file to verify nextEligibleISO formula (lastRunISO + 30m); cannot confirm guard fires correctly.
- **State contract** — BROKEN: body promises data.inflightPr, data.inflightSinceISO, data.nextEligibleISO, cursor; state file never created (0 commits). Duty has been active since 2026-05-27 with no observable state mutations.
- **One-action-max** — PASS: step 1 handles one in-flight PR verdict; step 2 dispatches exactly one ui-review and sets one inflightPr.
- **Idempotence** — PASS: step 1 checks verdict before acting; step 2 filters out PRs already carrying kody:ui-verified/kody:ui-failed/kody:reviewing-ui labels; no timestamp in body.
- **Allowed-commands vs Restrictions** — PASS: gh pr list/view/comment/merge and gh issue list/view/comment listed; restrictions prohibit direct approval and enforce advisory-only merge (auto-merge only via ledger graduation).
- **Observed behavior** — BROKEN: state file never created; 0 commits to .kody/duties/qa-verify.state.json since duty creation (2026-05-27). No evidence the duty has ever executed. Additionally, note that job-gap-scan has a BROKEN finding (state file location split between .kody/jobs/ and .kody/duties/) that should be corrected in the roster.
