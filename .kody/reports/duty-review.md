# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 5 — 0 healthy, 10 warn, 14 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | | | broken | state.json never created; 0 commits to state file despite 2 commits to body; data.prs persistence impossible across ticks |
| architecture-audit | | 7d (disabled) | broken | disabled=true but referenced script .kody/scripts/architecture-audit-tick.py does not exist; state path in body still points to deprecated .kody/jobs/ after migration |
| ceo-performance-review | | | broken | report file now confirmed present (2039 bytes) but state.json still never created; lastRunISO, nextEligibleISO, cycle, lastGrades never persisted |
| cleanup-branches | | | broken | no per-tick procedure; describes policy only with no executable steps; allowed-commands includes git push (non-gh) but no gh write method for branch deletion |
| clear-empty-goals | | | broken | no procedure whatsoever; Job states intent but provides zero steps, no system target, no state schema, no kody-job-next-state block; state never created |
| coverage-floor | | 1d (disabled) | broken | referenced script .kody/scripts/coverage-floor-tick.py does not exist; cadence formula inconsistency (every: 1d vs documented +20h); state never persisted at either .kody/jobs/ or .kody/duties/ |
| dead-code-sweep | | 7d (disabled) | broken | script .kody/scripts/dead-code-sweep-tick.py never implemented despite body refactor on 2026-05-28 explicitly noting it needed to be created; state at legacy .kody/jobs/ path with schema mismatch |
| dependency-bump | | 7d (disabled) | broken | script .kody/scripts/dependency-bump-tick.py does not exist; body still references legacy .kody/jobs/ path for state (file removed from tracking per #1502); disabled=true masks behavioral finding |
| design-review | | 7d | broken | cadence guard (6d) contradicts frontmatter every: 7d; body has no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| dev-ci-health | | 15m | broken | kody-job-next-state block present but missing required fields lastRunISO and nextEligibleISO used by duty-review engine; state file never created; allowed-commands does not list gh workflow run |
| docs-code | | 1d | broken | no kody-job-next-state block; state.json never created; lastRunISO never persisted; evidence shows at least one issue was opened (#2186) |
| docs-readme | | 7d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| flaky-test-quarantine | | 1h (disabled) | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| health-check | | 10m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| job-gap-scan | | 1d | broken | state.json persisted to .kody/jobs/ (legacy path) while body says .kody/duties/; migration moved file but script still writes to old location; two non-identical state files exist |
| pr-health-triage | | 2h | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| publish-release | | 7d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| qa | qa | 30m | broken | state frozen at 2026-05-23; lastFiredAt and nextEligibleISO both stale (10+ days); no cadence guard to restart; kody-job-next-state never emitted; nextEligibleISO never recalculated |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; duty body updated 2026-05-28 but state not; cursor idle with no open issue — duty completed but engine stopped invoking 5+ days ago |
| qa-verify | qa | 30m | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO never persisted |
| redispatch | | 10m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| security-audit | | 7d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted; disabled=true design review only |
| system-audit | | 6h | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| task-memory-extractor | | 7d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| type-debt | | 7d (disabled) | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |