# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 2 — 0 healthy, 18 warn, 7 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | ceo | 15m | broken | state.json never created; 0 commits to state file despite 2 commits to body; data.prs persistence impossible across ticks |
| architecture-audit | ceo | 7d (disabled) | broken | disabled=true but referenced script .kody/scripts/architecture-audit-tick.py does not exist; state path in body still points to deprecated .kody/jobs/ after migration |
| ceo-performance-review | ceo | 7d | broken | state.json never created; report ran once (cycle 1, May 27) but promised lastRunISO, nextEligibleISO, cycle, lastGrades never persisted |
| cleanup-branches | ceo | 7d | broken | no per-tick procedure; no kody-job-next-state block; allowed-commands lists git push --delete but only gh api PUT is permitted; state file never created |
| clear-empty-goals | ceo | 7d | broken | no procedure whatsoever; Job states intent (remove gods with no tasks) but provides zero steps, no system target, no state schema, no kody-job-next-state block; state never created |
| coverage-floor | ceo | 1d | broken | referenced script .kody/scripts/coverage-floor-tick.py does not exist; cadence formula inconsistency (every: 1d vs documented +20h); state never persisted at either .kody/jobs/ or .kody/duties/ |
| dead-code-sweep | ceo | 7d | broken | script .kody/scripts/dead-code-sweep-tick.py never implemented despite body refactor on 2026-05-28 explicitly noting it needed to be created; state at legacy .kody/jobs/ path with schema mismatch (openIssue: 1493 vs report's #1527) |
| dependency-bump | ceo | 1d (disabled) | broken | script .kody/scripts/dependency-bump-tick.py does not exist; body still references legacy .kody/jobs/ path for state (file removed from tracking per #1502); disabled=true masks behavioral finding |
| design-review | ceo | 7d | broken | cadence guard (6d) contradicts frontmatter every: 7d; body has no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| dev-ci-health | cto | 15m | broken | kody-job-next-state block present but missing required fields lastRunISO and nextEligibleISO used by duty-review engine; state file never created; allowed-commands does not list gh workflow run (dispatch step) |
| docs-code | ceo | 7d | broken | no kody-job-next-state block in body; state.json never created; lastRunISO never persisted; evidence shows at least one issue was opened (#2186) |
| docs-readme | ceo | 30d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| flaky-test-quarantine | qa | 1d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| health-check | qa | 1h | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| job-gap-scan | ceo | 1h | broken | state.json persisted to .kody/jobs/ (legacy path) while body says .kody/duties/; migration moved file but script still writes to old location; two non-identical state files exist |
| pr-health-triage | cto | 15m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| publish-release | ceo | 30d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| qa | qa | 1h | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| qa-sweep | qa | 7d | broken | lastRunISO frozen at 2026-05-23; duty body updated 2026-05-28 but state not; cursor idle with no open issue — duty completed but engine stopped invoking 5+ days ago |
| qa-verify | qa | 1h | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO never persisted |
| redispatch | ceo | 1h | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| security-audit | ceo | 7d (disabled) | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted; disabled=true design review only |
| system-audit | ceo | 1h | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| task-memory-extractor | ceo | 15m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| type-debt | ceo | 7d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |

_Verdicts reflect design soundness and run evidence only — not a live test._