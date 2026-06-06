# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 9 — 0 healthy, 10 warn, 15 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | state.json never created; never ticked |
| architecture-audit | cto | 7d (disabled) | broken | script never existed (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block; disabled=true design review only |
| ceo-performance-review | ceo | 7d | broken | procedure cannot emit kody-job-next-state (no write step); state never created |
| cleanup-branches | coo | manual | broken | no per-tick procedure; policy-only; no gh write method |
| clear-empty-goals | none | 1d | broken | 0 steps; no system target; no kody-job-next-state block |
| coverage-floor | kody | 1d (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block; disabled=true so idle by design |
| dead-code-sweep | kody | 30d (disabled) | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | kody | 7d (disabled) | broken | script absent (404); body references deprecated .kody/jobs/ path |
| design-review | ux-designer | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | cto | 15m | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | tech-writer | 1d | broken | no kody-job-next-state block; state never created |
| docs-readme | tech-writer | 1d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | kody | 1d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
| health-check | kody | 1d | warn | no kody-job-next-state block; state never created |
| job-gap-scan | ceo | — | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | cto | 15m | warn | no kody-job-next-state block; state never created |
| publish-release | cto | manual (disabled) | warn | no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 1d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 30m | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 30m | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | kody | 30m | warn | no kody-job-next-state block; state never created |
| security-audit | cto | 1d (disabled) | warn | no kody-job-next-state block; disabled=true design review only |
| system-audit | coo | 30m | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | coo | 30m | warn | no kody-job-next-state block; state never created |
| type-debt | kody | 7d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design