# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 2 — 4 healthy, 1 warn, 13 broken of 24 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | — | 1d | broken | state.json never created; data.prs persistence impossible across ticks |
| architecture-audit | — | 1d (disabled) | broken | disabled=true but referenced script .kody/scripts/architecture-audit-tick.py does not exist; state path in body still points to deprecated .kody/jobs/ after migration |
| ceo-performance-review | ceo | 7d | broken | state.json never created; report ran once (cycle 1, May 27) but promised lastRunISO, nextEligibleISO, cycle, lastGrades never persisted |
| cleanup-branches | — | 1d | broken | no per-tick procedure; no kody-job-next-state block; allowed-commands lists git push --delete but only gh api PUT is permitted; state file never created |
| clear-empty-goals | — | 1d | broken | no procedure whatsoever; Job states intent (remove gods with no tasks) but provides zero steps, no system target, no state schema, no kody-job-next-state block; state never created |
| coverage-floor | — | 1d | broken | referenced script .kody/scripts/coverage-floor-tick.py does not exist; cadence formula inconsistency (every: 1d vs documented +20h); state never persisted at either .kody/jobs/ or .kody/duties/ |
| dead-code-sweep | — | 7d | broken | script .kody/scripts/dead-code-sweep-tick.py never implemented despite body refactor on 2026-05-28 explicitly noting it needed to be created; state at legacy .kody/jobs/ path with schema mismatch (openIssue: 1493 vs report's #1527) |
| dependency-bump | — | 7d (disabled) | broken | script .kody/scripts/dependency-bump-tick.py does not exist; body still references legacy .kody/jobs/ path for state (file removed from tracking per #1502); disabled=true masks behavioral finding |
| design-review | ux-designer | 7d | broken | cadence guard (6d) contradicts frontmatter every: 7d; body has no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| docs-code | — | 14d | pending | pending |
| docs-readme | — | 14d | pending | pending |
| flaky-test-quarantine | — | 7d | pending | pending |
| health-check | — | 1d | pending | pending |
| job-gap-scan | — | 1d | broken | state.json persisted to .kody/jobs/ (legacy path) while body says .kody/duties/; migration moved file but script still writes to old location; two non-identical state files exist |
| pr-health-triage | — | 1d | pending | pending |
| publish-release | — | — | pending | pending |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; duty body updated 2026-05-28 but state not; cursor idle with no open issue — duty completed but engine stopped invoking 5+ days ago |
| qa-verify | qa | 1d | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO never persisted |
| qa | qa | — | pending | pending |
| redispatch | — | 1h | pending | pending |
| security-audit | — | 7d | pending | pending |
| system-audit | — | 1d | pending | pending |
| task-memory-extractor | — | 1d | pending | pending |
| type-debt | — | 7d | pending | pending