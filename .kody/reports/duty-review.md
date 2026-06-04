# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 6 — 15 healthy, 0 warn, 25 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | ceo | 6h | broken | state.json never created; lastRunISO never persisted; data.prs persistence impossible across ticks |
| architecture-audit | cto | 7d (disabled) | broken | script never existed; state path in body points to deprecated .kody/jobs/; procedure commits + pushes violating one-action-max |
| ceo-performance-review | ceo | 7d | broken | report file present (2039 bytes) but state.json never created; lastRunISO/cycle never persisted |
| cleanup-branches | ceo | 2h | broken | no per-tick procedure; describes policy only; allowed-commands includes git push but no gh write method |
| clear-empty-goals | ceo | daily | broken | no procedure whatsoever; zero steps; no system target; no kody-job-next-state block; state never created |
| coverage-floor | ceo | 1d | broken | referenced script does not exist; cadence formula inconsistency (every: 1d vs +20h); state never persisted |
| dead-code-sweep | ceo | 7d | broken | script never implemented despite body refactor noting it needed creation; state at legacy .kody/jobs/ path |
| dependency-bump | ceo | 14d | broken | script does not exist; body still references legacy .kody/jobs/ path for state; disabled=true masks finding |
| design-review | ceo | 7d | broken | cadence guard (6d) contradicts frontmatter every: 7d; no kody-job-next-state block; state never created |
| dev-ci-health | ceo | 1h | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields; state file never created |
| docs-code | ceo | 7d | broken | no kody-job-next-state block; state never created; lastRunISO never persisted |
| docs-readme | ceo | 7d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | ceo | 1d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| health-check | ceo | 1h | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| job-gap-scan | ceo | 7d | broken | state persisted to legacy .kody/jobs/ path; script still writes to old location; two non-identical state files exist |
| pr-health-triage | ceo | 2h | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| publish-release | ceo | - | warn | no kody-job-next-state block; state never created; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not; cursor idle with no open issue |
| qa-verify | qa | 7d | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever |
| qa | qa | 1d | broken | state frozen at 2026-05-23; lastFiredAt and nextEligibleISO both stale (10+ days); no cadence guard to restart |
| redispatch | ceo | 30m | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| security-audit | ceo | 7d | warn | no kody-job-next-state block; state never created; disabled=true design review only |
| system-audit | ceo | 1h | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| task-memory-extractor | ceo | 1d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| type-debt | ceo | 7d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |