# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 7 — 0 healthy, 7 warn, 19 broken of 26 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | ceo | 7d | broken | design sound; state.json never created; never ticked |
| architecture-audit | cto | 7d (disabled) | broken | script never existed; state path deprecated .kody/jobs/; commits violate one-action-max |
| ceo-performance-review | ceo | 14d | broken | procedure cannot emit kody-job-next-state (no write step); state never created |
| cleanup-branches | ceo | 7d | broken | no per-tick procedure; policy-only; no gh write method |
| clear-empty-goals | ceo | 7d | broken | zero steps; no system target; no kody-job-next-state block |
| coverage-floor | platform | 1d | broken | script missing; cadence formula inconsistency (every: 1d vs +20h) |
| dead-code-sweep | cto | 7d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | platform | 30d | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | cto | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | platform | 1d | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | cto | 14d | broken | no kody-job-next-state block; state never created |
| docs-readme | cto | 14d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | qa | 7d | warn | no kody-job-next-state block; state never created |
| health-check | platform | 1d | warn | no kody-job-next-state block; state never created |
| job-gap-scan | cto | 7d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | ceo | 7d | warn | no kody-job-next-state block; state never created |
| publish-release | platform | 30d (disabled) | warn | no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 7d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 7d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | ceo | 7d | warn | no kody-job-next-state block; state never created |
| security-audit | cto | 30d (disabled) | warn | no kody-job-next-state block; disabled=true design review only |
| system-audit | ceo | 1h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | ceo | 7d | warn | no kody-job-next-state block; state never created |
| type-debt | platform | 14d | warn | no kody-job-next-state block; state never created |
