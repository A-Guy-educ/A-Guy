# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

## Headline

Cycle 12 — 1 healthy, 14 broken, 10 warn of 25 duties.

## Roster

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | ? | broken | state contract documented but never produced; kody-job-next-state block not emitted by any procedure step; state file never created (0 commits, 404) |
| architecture-audit | cto | disabled | broken | script never existed (404); body references deprecated .kody/jobs/ path; no kody-job-next-state block; disabled=true design review only |
| ceo-performance-review | ceo | 7d | broken | kody-job-next-state block never emitted by procedure; state file never created (0 commits, 404) |
| cleanup-branches | coo | ? | healthy | passes every check |
| clear-empty-goals | — | ? | broken | 0 steps; no system target; no kody-job-next-state block |
| coverage-floor | kody | disabled | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure; disabled=true so idle by design |
| dead-code-sweep | kody | disabled | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | kody | disabled | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | ux-designer | ? | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | cto | ? | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | tech-writer | ? | broken | no kody-job-next-state block; state never created |
| docs-readme | tech-writer | ? | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | kody | disabled | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
| health-check | kody | ? | warn | no kody-job-next-state block; state never created |
| job-gap-scan | ceo | ? | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | cto | ? | warn | no kody-job-next-state block; state never created |
| publish-release | cto | disabled | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | ? | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | ? | broken | state.json never created; 0 commits to state file ever |
| qa | qa | ? | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | kody | ? | warn | no kody-job-next-state block; state never created |
| security-audit | cto | disabled | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| system-audit | coo | ? | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | coo | ? | warn | no kody-job-next-state block; state never created |
| type-debt | kody | disabled | warn | no kody-job-next-state block; state never created; disabled=true so idle by design