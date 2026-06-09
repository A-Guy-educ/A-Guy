# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

**Cycle 16** — 1 healthy, 9 warn, 15 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | kody-job-next-state block now present in body, but state file still never created (0 commits to state path, 404) |
| architecture-audit | cto | 7d (disabled) | broken | script never implemented (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block in procedure |
| ceo-performance-review | ceo | 1h | broken | kody-job-next-state block never emitted by procedure; state file never created |
| cleanup-branches | coo | 1d | healthy | passes every check |
| clear-empty-goals | — | 1h | broken | 0-step body; no kody-job-next-state block; state file never created |
| coverage-floor | kody | 1d (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure |
| dead-code-sweep | kody | 7d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | kody | 7d | broken | script absent (404); body references deprecated .kody/jobs/ path |
| design-review | ux-designer | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | cto | 15m | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | tech-writer | 7d | broken | no kody-job-next-state block; state file never created |
| docs-readme | tech-writer | 7d | warn | no kody-job-next-state block; state file never created; lastRunISO never persisted |
| flaky-test-quarantine | kody | 7d (disabled) | warn | no kody-job-next-state block; disabled=true so idle by design |
| health-check | kody | 15m | warn | no kody-job-next-state block; state file never created |
| job-gap-scan | ceo | 1h | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | cto | 1h | warn | no kody-job-next-state block; state file never created |
| publish-release | cto | 7d (disabled) | warn | no kody-job-next-state block; disabled=true so idle by design |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 1h | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 7d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | kody | 15m | warn | no kody-job-next-state block; state file never created |
| security-audit | cto | 7d (disabled) | warn | no kody-job-next-state block; disabled=true so idle by design |
| system-audit | coo | 15m | warn | no kody-job-next-state block; state file never created |
| task-memory-extractor | coo | 1h | warn | no kody-job-next-state block; state file never created |
| type-debt | kody | 7d (disabled) | warn | no kody-job-next-state block; state file never created; disabled=true so idle by design |