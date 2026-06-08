# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 13 — 1 healthy, 10 warn, 14 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | state contract documented but never produced; kody-job-next-state block not emitted by any procedure step; state file never created (0 commits, 404) |
| architecture-audit | ceo | 7d (disabled) | broken | script never existed (404); body references debrecated .kody/jobs/ path; no kody-job-next-state block; disabled=true design review only |
| ceo-performance-review | ceo | 7d | broken | kody-job-next-state block never emitted by procedure; state file never created (0 commits, 404) |
| cleanup-branches | ceo | manual | healthy | passes every check |
| clear-empty-goals | ceo | 1d | broken | 0-step body; no kody-job-next-state block; state file never created |
| coverage-floor | ceo | 1d (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure; disabled=true so idle by design |
| dead-code-sweep | ceo | 30d (disabled) | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependenct-bump | ceo | 7d (disabled) | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | ceo | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | ceo | 15m | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | ceo | 1d | broken | no kody-job-next-state block; state never created |
| docs-readme | ceo | 1d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | ceo | 1d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design |
| health-check | ceo | 1d | warn | no kody-job-next-state block; state never created |
| job-gap-scan | ceo | — | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | ceo | 15m | warn | no kody-job-next-state block; state never created |
| publish-release | ceo | manual (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 30m | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 30m | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | ceo | 30m | warn | no kody-job-next-state block; state never created |
| security-audit | ceo | 1d (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| system-audit | ceo | 30m | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | ceo | 30m | warn | no kody-job-next-state block; state never created |
| type-debt | ceo | 7d (disabled) | warn | no kody-job-next-state block; state never created; disabled=true so idle by design
