# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 2 — 0 healthy, 0 warn, 9 broken, 15 pending of 24 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | | 1d | broken | state.json never created; 0 commits to state file despite 2 commits to body; data.prs persistence impossible across ticks |
| architecture-audit | | 1d (disabled) | broken | disabled=true but referenced script .kody/scripts/architecture-audit-tick.py does not exist; state path in body still points to deprecated .kody/jobs/ after migration |
| ceo-performance-review | | 1d | broken | state.json never created; report ran once (cycle 1, May 27) but promised lastRunISO, nextEligibleISO, cycle, lastGrades never persisted |
| cleanup-branches | | 1d | broken | no per-tick procedure; no kody-job-next-state block; allowed-commands lists git push --delete but only gh api PUT is permitted; state file never created |
| clear-empty-goals | | 1d | broken | no procedure whatsoever; Job states intent (remove gods with no tasks) but provides zero steps, no system target, no state schema, no kody-job-next-state block; state never created |
| coverage-floor | kody | 1d (disabled) | broken | referenced script .kody/scripts/coverage-floor-tick.py does not exist; cadence formula inconsistency (every: 1d vs documented +20h); state never persisted at either .kody/jobs/ or .kody/duties/ |
| dead-code-sweep | | 1d (disabled) | pending | pending |
| dependency-bump | | 1d (disabled) | pending | pending |
| design-review | | 1d | pending | pending |
| docs-code | | 1d | pending | pending |
| docs-readme | | 1d | pending | pending |
| flaky-test-quarantine | | 1d (disabled) | pending | pending |
| health-check | | 1d | pending | pending |
| job-gap-scan | | 1d | broken | state.json persisted to .kody/jobs/ (legacy path) while body says .kody/duties/; migration moved file but script still writes to old location; two non-identical state files exist |
| pr-health-triage | | 1d | pending | pending |
| publish-release | | 1d | pending | pending |
| qa-sweep | | 7d | broken | lastRunISO frozen at 2026-05-23; duty body updated 2026-05-28 but state not; cursor idle with no open issue — duty completed but engine stopped invoking 5+ days ago |
| qa-verify | | 1d | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO never persisted |
| qa | | 1d | pending | pending |
| redispatch | | 1d | pending | pending |
| security-audit | | 1d | pending | pending |
| system-audit | | 1d | pending | pending |
| task-memory-extractor | | 1d | pending | pending |
| type-debt | | 1d (disabled) | pending | pending |

disabled flag is intentional idleness — not a finding. All broken duties need operator review.