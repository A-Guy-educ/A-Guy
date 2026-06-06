# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 11 — 0 healthy, 7 warn, 18 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | | manual | broken | state.json never created; never ticked |
| architecture-audit | | 30d (disabled) | broken | script never existed (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block; disabled=true design review only |
| ceo-performance-review | | manual | broken | kody-job-next-state block never emitted by procedure; state file never created |
| cleanup-branches | coo | manual | broken | no per-tick procedure; policy-only; no gh write method to persist state |
| clear-empty-goals | | 1d | broken | 0 steps; no system target; no kody-job-next-state block |
| coverage-floor | | 20h (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block; disabled=true so idle by design |
| dead-code-sweep | | 14d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | | 14d | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | | 5m | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | | 14d | broken | no kody-job-next-state block; state never created |
| docs-readme | | 14d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | | 7d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
| health-check | | 30m | warn | no kody-job-next-state block; state never created |
| job-gap-scan | | 7d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | | 7d | warn | no kody-job-next-state block; state never created |
| publish-release | | manual (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | manual | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 1d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | | 1h | warn | no kody-job-next-state block; state never created |
| security-audit | | 30d (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| system-audit | | 6h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | | 7d | warn | no kody-job-next-state block; state never created |
| type-debt | | 7d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design