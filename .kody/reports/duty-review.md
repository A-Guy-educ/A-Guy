# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 13 — 1 healthy, 4 warn, 19 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | | 1d | broken | state contract documented but never produced; kody-job-next-state block not emitted by any procedure step; state file never created (0 commits, 404) |
| architecture-audit | | 1d | broken | script never existed (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block; disabled=true design review only |
| ceo-performance-review | | 1d | broken | kody-job-next-state block never emitted by procedure; state file never created (0 commits, 404) |
| cleanup-branches | | 1d | healthy | passes every check |
| clear-empty-goals | | 1d | broken | 0-step body; no kody-job-next-state block; state file never created |
| coverage-floor | | 1d | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure; disabled=true so idle by design |
| dead-code-sweep | | 1d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | | 1d | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | | 1d | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | | 1d | broken | no kody-job-next-state block; state never created |
| docs-readme | | 1d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| duty-review | | 6h | — | pending |
| flaky-test-quarantine | | 1d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
| health-check | | 1d | warn | no kody-job-next-state block; state never created |
| job-gap-scan | | 1d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | | 1d | warn | no kody-job-next-state block; state never created |
| publish-release | | 7d (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | | 7d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 7d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | | 1d | warn | no kody-job-next-state block; state never created |
| security-audit | | 7d (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| system-audit | | 6h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | | 1d | warn | no kody-job-next-state block; state never created |
| type-debt | | 1d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
