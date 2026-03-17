# Plan: Document Pipeline Health Monitoring Architecture

## Step 1: Create documentation directory and file

**Files:**
- `docs/system-test/pipeline-health.md` (NEW)

**What:**
Create the `docs/system-test/` directory and the comprehensive documentation file `pipeline-health.md` covering all 6 required sections:

1. **Overview section** — Inspector plugin framework architecture
   - Reference: `scripts/inspector/index.ts` (entry point), `scripts/inspector/core/inspector.ts` (orchestrator), `scripts/inspector/core/types.ts` (InspectorPlugin, ActionRequest, InspectorContext interfaces), `scripts/inspector/plugins/registry.ts` (PluginRegistry class)
   - Cover: plugin lifecycle, cycle-based scheduling, state store (JSON file local vs GH variable in CI), dedup engine, error isolation
   - Reference: `scripts/inspector/core/state.ts` (JsonStateStore, GhVariableStateStore), `scripts/inspector/core/dedup.ts` (shouldDedup, markExecuted, cleanupExpiredDedup)

2. **Health-check plugins section** — Each plugin and what it monitors
   - `scripts/inspector/plugins/cody/health-check/index.ts` — Task health evaluation (healthy/stalled/failed/gated/orphaned/completed), nudge actions, digest reports
   - `scripts/inspector/plugins/cody/health-check/discovery.ts` — Task discovery from GitHub issues
   - `scripts/inspector/plugins/cody/pipeline-fixer/index.ts` — Retry failed tasks with escalation
   - `scripts/inspector/plugins/cody/zombie-reaper/index.ts` — Clean up stuck tasks
   - `scripts/inspector/plugins/cody/queue-manager/index.ts` — Queue management
   - `scripts/inspector/plugins/cody/success-tracker/index.ts` — Success metrics
   - `scripts/inspector/plugins/cody/failure-miner/index.ts` — Failure pattern analysis
   - `scripts/inspector/plugins/cody/knowledge-gardener/index.ts` — Knowledge extraction
   - `scripts/inspector/plugins/cody/audit/index.ts` — Audit analysis
   - `scripts/inspector/plugins/cody/deferred-stages/index.ts` — Deferred docs stage
   - `scripts/inspector/plugins/cody/deferred-tests/index.ts` — Deferred tests stage
   - `scripts/inspector/plugins/cody/system-test/index.ts` — System test coordination
   - `scripts/inspector/plugins/cody/cli-test/index.ts` — CLI test coordination
   - `scripts/inspector/plugins/project/security-scanner/index.ts` — Security scanning
   - `scripts/inspector/plugins/project/api-surface/index.ts` — API surface auditing
   - `scripts/inspector/plugins/docs-sync/index.ts` — Documentation sync
   - `scripts/inspector/clients/github.ts` — GitHub API client
   - `scripts/inspector/clients/slack.ts` — Slack notification client

3. **Pipeline-fixer retry strategy section** — Detailed retry flow
   - Constants: MAX_RETRIES=5, FIX_ISSUE_THRESHOLD=2, DEDUP_WINDOW_MINUTES=15
   - Flow: Retry 1-2 (simple rerun) → Retry 3 (create fix issue if same error) → Retry 4-5 (post-fix rerun) → Give up
   - Non-retryable errors: API key, disk full
   - Cross-task dedup: findExistingFixIssue checks fixer state + GitHub search
   - State pruning: MAX_ENTRIES=100

4. **Deferred test and docs stages section**
   - Deferred docs: complexity ≥ 30 threshold, every 6th cycle, 6hr dedup, checks PR completed + docs not completed + docs.md not exists
   - Deferred tests: no complexity threshold, 7-day staleness guard, every 6th cycle, same eligibility pattern
   - Both trigger via `cody.yml` workflow dispatch with `mode=rerun`

5. **Troubleshooting guide** — Common failure modes
   - Orphaned workflows (status.json stale but CI terminated)
   - Zombie tasks (running > 2hrs with no active workflow)
   - Stalled tasks (no progress > 20min staleness threshold)
   - Non-retryable infrastructure failures
   - Plugin ordering violations (health-check must precede pipeline-fixer and queue-manager)
   - State persistence failures (GH variable write fails)
   - Dedup preventing expected actions

6. **Architecture diagrams** — Mermaid syntax
   - Inspector loop flow diagram
   - Plugin dependency graph (health-check → pipeline-fixer, health-check → queue-manager)
   - Pipeline-fixer retry state machine
   - Deferred stages eligibility flowchart

**Test gate:**
- File exists at `docs/system-test/pipeline-health.md`
- Word count ≥ 2000
- Contains all 6 section headers
- Contains `mermaid` code blocks
- References actual file paths from `scripts/inspector/`
