# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

## Cycle 10 — 0 healthy, 8 warn, 17 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | — | — | broken | state.json never created; never ticked |
| architecture-audit | — | — (disabled) | broken | script never existed (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block; disabled=true design review only |
| ceo-performance-review | ceo | 7d | broken | kody-job-next-state block never emitted by procedure; state file never created |
| cleanup-branches | — | — | broken | no per-tick procedure; policy-only; no gh write method |
| clear-empty-goals | — | — | broken | 0 steps; no system target; no kody-job-next-state block |
| coverage-floor | — | — (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure; disabled=true so idle by design |
| dead-code-sweep | — | — | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | — | — | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | ux-designer | 7d (disabled) | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | — | 1h | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | — | 1d | broken | no kody-job-next-state block; state never created |
| docs-readme | — | 7d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | qa | 7d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
| health-check | kody | 1d | warn | no kody-job-next-state block; state never created |
| job-gap-scan | — | 1h | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | — | 1d | warn | no kody-job-next-state block; state never created |
| publish-release | — | — (disabled) | warn | no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 7d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 1h | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | — | 1h | warn | no kody-job-next-state block; state never created |
| security-audit | — | — (disabled) | warn | no kody-job-next-state block; disabled=true design review only |
| system-audit | — | 1h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | coo | 1h | warn | no kody-job-next-state block; state never created |
| type-debt | — | — (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |