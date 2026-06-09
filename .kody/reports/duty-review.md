# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

## Cycle 16 — 1 healthy, 10 warn, 14 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | ceo | 1h | broken | kody-job-next-state block now present in body, but state file still never created (0 commits to state path, 404) |
| architecture-audit | ceo | 30d | broken | script never implemented (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block in procedure |
| ceo-performance-review | ceo | 7d | broken | kody-job-next-state block never emitted by procedure; state file never created |
| cleanup-branches | coo | 1h | healthy | passes every check |
| clear-empty-goals | ceo | 1d | broken | 0-step body; no kody-job-next-state block; state file never created |
| coverage-floor | cto | 1d (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure; disabled=true so idle by design |
| dead-code-sweep | cto | 30d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | cto | 30d | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | ux-designer | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | cto | 1h | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | ceo | 14d | broken | no kody-job-next-state block; state never created |
| docs-readme | ceo | 14d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | qa | 1h (disabled) | warn | no kody-job-next-state block; disabled=true so idle by design |
| health-check | kody | 1h | warn | no kody-job-next-state block; state never created |
| job-gap-scan | cto | 1d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | coo | 1h | warn | no kody-job-next-state block; state never created |
| publish-release | ceo | 30d (disabled) | warn | no kody-job-next-state block; disabled=true so idle by design |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 7d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 1h | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | ceo | 1h | warn | no kody-job-next-state block; state never created |
| security-audit | cto | 7d (disabled) | warn | no kody-job-next-state block; disabled=true so idle by design |
| system-audit | coo | 1h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | ceo | 1d | warn | no kody-job-next-state block; state never created |
| type-debt | cto | 1d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design