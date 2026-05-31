# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 2 — 0 healthy, 0 warn, 10 broken of 24 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | | | broken | state.json never created; 0 commits to state file despite 2 commits to body; data.prs persistence impossible across ticks |
| architecture-audit | | 7d (disabled) | broken | disabled=true but referenced script .kody/scripts/architecture-audit-tick.py does not exist; state path in body still points to deprecated .kody/jobs/ after migration |
| ceo-performance-review | | | broken | state.json never created; report ran once (cycle 1, May 27) but promised lastRunISO, nextEligibleISO, cycle, lastGrades never persisted |
| cleanup-branches | | | broken | no per-tick procedure; no kody-job-next-state block; allowed-commands lists git push --delete but only gh api PUT is permitted; state file never created |
| clear-empty-goals | | | broken | no procedure whatsoever; Job states intent (remove gods with no tasks) but provides zero steps, no system target, no state schema, no kody-job-next-state block; state never created |
| coverage-floor | | 1d (disabled) | broken | referenced script .kody/scripts/coverage-floor-tick.py does not exist; cadence formula inconsistency (every: 1d vs documented +20h); state never persisted at either .kody/jobs/ or .kody/duties/ |
| dead-code-sweep | kody | 30d (disabled) | broken | script .kody/scripts/dead-code-sweep-tick.py never implemented despite body refactor on 2026-05-28 explicitly noting it needed to be created; state at legacy .kody/jobs/ path with schema mismatch (openIssue: 1493 vs report's #1527) |
| dependency-bump | | 30d | pending | — |
| design-review | | 7d | pending | — |
| docs-code | | 14d | pending | — |
| docs-readme | | 14d | pending | — |
| flaky-test-quarantine | | 1d (disabled) | pending | — |
| health-check | | 1d | pending | — |
| job-gap-scan | | 1d | broken | state.json persisted to .kody/jobs/ (legacy path) while body says .kody/duties/; migration moved file but script still writes to old location; two non-identical state files exist |
| pr-health-triage | | 1d | pending | — |
| publish-release | | | pending | — |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; duty body updated 2026-05-28 but state not; cursor idle with no open issue — duty completed but engine stopped invoking 5+ days ago |
| qa-verify | qa | 1d | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO never persisted |
| qa | qa | 1d | pending | — |
| redispatch | | 1d | pending | — |
| security-audit | | 7d | pending | — |
| system-audit | | 1d | pending | — |
| task-memory-extractor | | 1d | pending | — |
| type-debt | | 30d (disabled) | pending | — |