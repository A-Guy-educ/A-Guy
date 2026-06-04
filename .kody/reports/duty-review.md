# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

## Cycle 7 — 0 healthy, 8 warn, 17 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | design sound; state.json never created; never ticked |
| architecture-audit | | 7d (disabled) | broken | script never existed; state path deprecated .kody/jobs/; commits violate one-action-max |
| ceo-performance-review | ceo | 7d | broken | procedure cannot emit kody-job-next-state (no write step); state never created |
| cleanup-branches | | 7d | broken | no per-tick procedure; policy-only; no gh write method |
| clear-empty-goals | | 7d | broken | zero steps; no system target; no kody-job-next-state block |
| coverage-floor | | 1d (disabled) | broken | script missing; cadence formula inconsistency (every: 1d vs +20h) |
| dead-code-sweep | | 7d (disabled) | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | | 7d (disabled) | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | | 1h | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | | 7d | broken | no kody-job-next-state block; state never created |
| docs-readme | | 7d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | | 7d (disabled) | warn | no kody-job-next-state block; state never created |
| health-check | | 7d | warn | no kody-job-next-state block; state never created |
| job-gap-scan | | 7d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | | 7d | warn | no kody-job-next-state block; state never created |
| publish-release | | 7d | warn | no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 7d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 7d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | | 7d | warn | no kody-job-next-state block; state never created |
| security-audit | | 7d | warn | no kody-job-next-state block; disabled=true design review only |
| system-audit | | 6h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | | 7d | warn | no kody-job-next-state block; state never created |
| type-debt | | 7d (disabled) | warn | no kody-job-next-state block; state never created |