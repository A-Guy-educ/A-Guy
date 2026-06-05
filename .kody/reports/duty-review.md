# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 9 — 0 healthy, 9 warn, 16 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | state.json never created; never ticked |
| architecture-audit | infra | 1h | broken | script never existed; state path deprecated .kody/jobs/; commits violate one-action-max |
| ceo-performance-review | ceo | 30m | broken | procedure cannot emit kody-job-next-state (no write step); state never created |
| cleanup-branches | infra | manual | broken | no per-tick procedure; policy-only; no gh write method |
| clear-empty-goals | ceo | 1d | broken | 0 steps; no system target; no kody-job-next-state block |
| coverage-floor | platform | 1d (disabled) | broken | script absent (404); cadence formula inconsistency (every: 1d vs +20h); no kody-job-next-state block in procedure |
| dead-code-sweep | infra | 1d | broken | script never implemented; state at legacy .kody/jobs/ path |
| dependency-bump | platform | 7d | broken | script absent; body references deprecated .kody/jobs/ path |
| design-review | design | 7d | broken | cadence guard (6d) contradicts every: 7d; no kody-job-next-state block |
| dev-ci-health | platform | 5m | broken | kody-job-next-state present but missing lastRunISO/nextEligibleISO fields |
| docs-code | docs | 1d | broken | no kody-job-next-state block; state never created |
| docs-readme | docs | 7d | warn | no kody-job-next-state block; state never created; lastRunISO never persisted |
| flaky-test-quarantine | qa | 1d | warn | no kody-job-next-state block; state never created |
| health-check | sre | 5m | warn | no kody-job-next-state block; state never created |
| job-gap-scan | platform | 1d | broken | state at legacy .kody/jobs/ path; script writes to old location; two non-identical state files |
| pr-health-triage | ceo | 1d | warn | no kody-job-next-state block; state never created |
| publish-release | platform | 1d (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; body updated 2026-05-28 but state not |
| qa-verify | qa | 1d | broken | state.json never created; 0 commits to state file ever |
| qa | qa | 1d | broken | lastRunISO frozen 2026-05-23; lastFiredAt and nextEligibleISO stale 10+ days |
| redispatch | platform | 15m | warn | no kody-job-next-state block; state never created |
| security-audit | security | 1d (disabled) | warn | (disabled) no kody-job-next-state block; disabled=true design review only |
| system-audit | infra | 1h | warn | no kody-job-next-state block; state never created |
| task-memory-extractor | platform | 1d | warn | no kody-job-next-state block; state never created |
| type-debt | platform | 1d | warn | no kody-job-next-state block; state never created |

---

_This tick: reviewed approval-gate. Design sound (goal clear, one-action-max, idempotent), but state.json never created — the duty has never run._