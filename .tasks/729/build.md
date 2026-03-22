# Build Agent Report: 729

## Changes

### Infrastructure Fixes (Step 0 gap)
- `scripts/inspector/core/types.ts` — added `WorkflowRun` interface and `listWorkflowRuns`, `createIssue`, `searchIssues` methods to `GitHubClient` interface; added `branch?` option to `listWorkflowRuns` opts (needed by zombie-reaper)
- `scripts/inspector/clients/github.ts` — implemented `listWorkflowRuns`, `createIssue`, `searchIssues` using `gh` CLI

### Step 2 (Success Rate Tracker) — tests verified passing
- `scripts/inspector/plugins/cody/success-tracker/metrics.ts` — `computeReport()`, `PeriodMetrics`, `TrackerReport` types
- `scripts/inspector/plugins/cody/success-tracker/formatter.ts` — `formatSlackMessage()`, `formatMarkdownReport()`
- `scripts/inspector/plugins/cody/success-tracker/index.ts` — `successTrackerPlugin` (every 6 + 23h dedup), Slack + watchdog actions

### Step 3 (Failure Pattern Miner)
- `scripts/inspector/plugins/cody/failure-miner/collector.ts` — `extractFailure()`, `collectFailures()`: scan `.tasks/` for failed status.json (v1+v2 format support)
- `scripts/inspector/plugins/cody/failure-miner/analyzer.ts` — `analyzeFailures()`: detects stage hotspots (≥2 failures) and 12 error patterns (≥2 occurrences) via regex matching
- `scripts/inspector/plugins/cody/failure-miner/reporter.ts` — `formatHotspotTitle/Body`, `formatErrorPatternTitle/Body`, search query helpers
- `scripts/inspector/plugins/cody/failure-miner/index.ts` — `failureMinerPlugin` (every 6 + 23h dedup), creates `cody:improvement` GitHub issues with dedup via `searchIssues`

### Step 4 (Knowledge Base Gardener)
- `scripts/inspector/plugins/cody/knowledge-gardener/extractor.ts` — `parseMemoryJson()`, `toKnowledgeEntry()`, `findNewMemoryFiles()`, `readKnowledgeIndex()`
- `scripts/inspector/plugins/cody/knowledge-gardener/pruner.ts` — `cultivate()`: merge entries, enforce 100-entry cap (prune oldest), track pattern frequency, detect skill candidates (threshold ≥3)
- `scripts/inspector/plugins/cody/knowledge-gardener/index.ts` — `knowledgeGardenerPlugin` (every 6 + 23h dedup), reads memory.json files, writes `.ai-docs/knowledge/index.json`, commits via git

### Plugin Registration
- `scripts/inspector/index.ts` — registered all 4 new plugins: `zombieReaperPlugin`, `successTrackerPlugin`, `failureMinerPlugin`, `knowledgeGardenerPlugin`

### Test Files Added
- `tests/unit/scripts/inspector/github-client.test.ts` — added 7 tests for `listWorkflowRuns`, `createIssue`, `searchIssues`
- `tests/unit/scripts/inspector/success-tracker.test.ts` — 16 tests (all passing)
- `tests/unit/scripts/inspector/failure-miner.test.ts` — 20 tests (all passing)
- `tests/unit/scripts/inspector/knowledge-gardener.test.ts` — 25 tests (all passing)

## Tests Written

- `tests/unit/scripts/inspector/github-client.test.ts` (extended)
- `tests/unit/scripts/inspector/success-tracker.test.ts`
- `tests/unit/scripts/inspector/failure-miner.test.ts`
- `tests/unit/scripts/inspector/knowledge-gardener.test.ts`

## Quality

- TypeScript: PASS (0 new errors; 5 pre-existing errors in unrelated files unchanged)
- Lint: PASS (✔ No ESLint warnings or errors)
- Tests: PASS — 209 test files, 3442 tests passing, 17 skipped (up from 207/3383)
