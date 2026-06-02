# Kody Duty Review

_Rolling 6h cycle — one duty deep-reviewed per tick._

Cycle 5 — 1 healthy, 10 warn, 14 broken of 25 duties.

| Duty | Staff | Cadence | Verdict | Note |
|------|-------|---------|---------|------|
| approval-gate | cto | 15m | broken | state.json never created; 0 commits to state file despite 2 commits to body; data.prs persistence impossible across ticks |
| architecture-audit | cto | 7d (disabled) | broken | disabled=true but referenced script .kody/scripts/architecture-audit-tick.py does not exist; state path in body still points to deprecated .kody/jobs/ after migration |
| ceo-performance-review | ceo | 7d | broken | report file now confirmed present (2039 bytes) but state.json still never created; lastRunISO, nextEligibleISO, cycle, lastGrades never persisted |
| cleanup-branches | coo | manual | broken | no per-tick procedure; no kody-job-next-state block; allowed-commands lists git push --delete but only gh api PUT is permitted; state file never created |
| clear-empty-goals | — | 1d | broken | no procedure whatsoever; Job states intent but provides zero steps, no system target, no state schema, no kody-job-next-state block; state never created |
| coverage-floor | kody | 1d (disabled) | broken | referenced script .kody/scripts/coverage-floor-tick.py does not exist; cadence formula inconsistency (every: 1d vs documented +20h); state never persisted at either .kody/jobs/ or .kody/duties/ |
| dead-code-sweep | kody | 30d (disabled) | broken | script .kody/scripts/dead-code-sweep-tick.py never implemented despite body refactor on 2026-05-28 explicitly noting it needed to be created; state at legacy .kody/jobs/ path with schema mismatch |
| dependency-bump | kody | 7d (disabled) | broken | script .kody/scripts/dependency-bump-tick.py does not exist; body still references legacy .kody/jobs/ path for state (file removed from tracking per #1502); disabled=true masks behavioral finding |
| design-review | ux-designer | 7d | broken | cadence guard (6d) contradicts frontmatter every: 7d; body has no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| dev-ci-health | cto | 15m | broken | kody-job-next-state block present but missing required fields lastRunISO and nextEligibleISO used by duty-review engine; state file never created; allowed-commands does not list gh workflow run |
| docs-code | tech-writer | 1d | broken | no kody-job-next-state block; state.json never created; lastRunISO never persisted; evidence shows at least one issue was opened (#2186) |
| docs-readme | tech-writer | 1d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| flaky-test-quarantine | kody | 1d (disabled) | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| health-check | kody | 1d | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| job-gap-scan | ceo | — | broken | state.json persisted to .kody/jobs/ (legacy path) while body says .kody/duties/; migration moved file but script still writes to old location; two non-identical state files exist |
| pr-health-triage | cto | 15m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| publish-release | cto | manual | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| qa-sweep | qa | 1d | broken | lastRunISO frozen at 2026-05-23; duty body updated 2026-05-28 but state not; cursor idle with no open issue — duty completed but engine stopped invoking 5+ days ago |
| qa-verify | qa | 30m | broken | state.json never created; duty body created 2026-05-27, 0 commits to state file ever; data.inflightPr, data.inflightSinceISO never persisted |
| qa | qa | 30m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| redispatch | kody | 30m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| security-audit | cto | 1d (disabled) | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted; disabled=true design review only |
| system-audit | coo | 30m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| task-memory-extractor | coo | 30m | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
| type-debt | kody | 7d (disabled) | warn | no kody-job-next-state block; state.json never created; lastRunISO never persisted |
