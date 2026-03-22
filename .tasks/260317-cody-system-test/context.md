# Codebase Context: 260317-cody-system-test

## Files to Modify
- `scripts/cody/pipeline/post-actions.ts` (line 75) — Remove `=== undefined` guard on complexity override
- `scripts/cody/modes/impl.ts` (line 40) — Remove `=== undefined` guard on complexity override
- `.github/workflows/cody.yml` (~line 440) — Add `COMPLEXITY` env var passthrough to Run Cody step
- `scripts/inspector/index.ts` (lines 24, 83) — Add import + registration of system-test plugin
- `.github/workflows/cody-system-test.yml` (NEW) — System test workflow
- `scripts/system-test/lib/config.ts` (NEW) — Shared constants
- `scripts/system-test/lib/gh-client.ts` (NEW) — GitHubClient wrapper
- `scripts/system-test/lib/poll.ts` (NEW) — Polling utilities
- `scripts/system-test/lib/assertions.ts` (NEW) — Assertion functions
- `scripts/system-test/lib/cleanup.ts` (NEW) — Cleanup functions
- `scripts/system-test/lib/report.ts` (NEW) — Report + Slack payload generation
- `scripts/system-test/lib/index.ts` (NEW) — Barrel export
- `scripts/system-test/scenarios/types.ts` (NEW) — Shared scenario types
- `scripts/system-test/scenarios/02-full-high-complexity.ts` (NEW) — The main system test
- `scripts/system-test/run-scenario.ts` (NEW) — CLI entry point
- `scripts/system-test/report-results.ts` (NEW) — Aggregate results for workflow
- `scripts/system-test/cleanup-all.ts` (NEW) — Cleanup safety net
- `scripts/inspector/plugins/cody/system-test/index.ts` (NEW) — Inspector plugin
- `scripts/system-test/README.md` (NEW) — Documentation
- `tests/unit/scripts/cody/complexity-override.test.ts` (NEW) — Override fix tests
- `tests/unit/scripts/system-test/poll.test.ts` (NEW)
- `tests/unit/scripts/system-test/assertions.test.ts` (NEW)
- `tests/unit/scripts/system-test/cleanup.test.ts` (NEW)
- `tests/unit/scripts/system-test/report.test.ts` (NEW)
- `tests/unit/scripts/inspector/system-test-plugin.test.ts` (NEW)

## Files to Read (reference patterns)
- `scripts/inspector/plugins/cody/deferred-tests/index.ts` — Pattern for workflow-dispatching plugin
- `scripts/inspector/core/types.ts` — InspectorPlugin, ActionRequest, GitHubClient, StateStore, WorkflowRun interfaces
- `scripts/inspector/clients/github.ts` — createGitHubClient, triggerWorkflow, createIssue, closeIssue, listWorkflowRuns
- `scripts/inspector/clients/slack.ts` — SlackClient for failure notifications
- `.github/workflows/cody.yml` — Pipeline workflow: dispatch inputs (7-55), orchestrate job (324-491), version overlay (389-405), Run Cody env (417-450)
- `scripts/cody/cli-parser.ts` — `--complexity` flag (line 41), COMPLEXITY env var (line 378)
- `scripts/cody/cody-utils.ts` — CodyInput type with complexityOverride (line 41)
- `scripts/cody/pipeline/post-actions.ts` — resolve-profile complexity override (lines 71-99)
- `scripts/cody/modes/impl.ts` — impl mode complexity override (lines 39-43)
- `scripts/cody/stages/registry.ts` — Stage complexity thresholds
- `tests/unit/scripts/cody/complexity-scoring.test.ts` — Existing complexity tests
- `opencode.json` — Model config (jq target for dynamic override)

## Key Signatures
- `InspectorPlugin`: `{ name, description, domain, schedule?, run(ctx): Promise<ActionRequest[]> }`
- `ActionRequest`: `{ plugin, type, target?, urgency, title, detail, dedupKey?, dedupWindowMinutes?, execute(ctx): Promise<ActionResult> }`
- `GitHubClient.triggerWorkflow(workflow: string, inputs: Record<string, string>): void`
- `GitHubClient.createIssue(title: string, body: string, labels: string[]): number | null`
- `GitHubClient.closeIssue(issueNumber: number, reason?: string): void`
- `GitHubClient.postComment(issueNumber: number, body: string): void`
- `GitHubClient.getIssueComments(issueNumber: number): IssueComment[]`
- `GitHubClient.listWorkflowRuns(workflow, opts?): WorkflowRun[]`
- `GitHubClient.searchIssues(query: string): IssueInfo[]`
- `WorkflowRun`: `{ id, status, conclusion, createdAt, updatedAt, headBranch, event }`
- `StateStore`: `{ get<T>(key), set<T>(key, value), save() }`
- `createGitHubClient(repo, token, patToken?): GitHubClient`
- `CodyInput.complexityOverride?: number` from `scripts/cody/cody-utils.ts`

## Reuse Inventory
- `GitHubClient` from `scripts/inspector/clients/github.ts` — All GitHub operations
- `createGitHubClient()` — Client factory with PAT support
- `InspectorPlugin` interface — Plugin contract
- `StateStore` — Persistent state across inspector cycles
- `pino` — Logger

## Integration Points
- Complexity fix: remove guard in `post-actions.ts:75` and `modes/impl.ts:40`
- `cody.yml`: add `COMPLEXITY: ${{ needs.parse.outputs.complexity }}` to Run Cody env vars
- Plugin registration: `scripts/inspector/index.ts` after `apiSurfaceAuditorPlugin`
- `cody-system-test.yml` must be on `dev`/`main` before it can be dispatched
- Model override: `jq` on temp branch `systest/<run_id>`, passed via `--version`
- `cody.yml` overlay: `git checkout "origin/$VERSION_REF" -- scripts/cody/ .opencode/agents/ opencode.json`
- Inspector `GH_PAT` required for workflow dispatch (already in inspector.yml)
- `SLACK_WEBHOOK_URL` for failure notifications (already in inspector.yml)

## Imports Verified
- `scripts/inspector/core/types` → InspectorPlugin, ActionRequest, InspectorContext, WorkflowRun ✅
- `scripts/inspector/clients/github` → createGitHubClient ✅
- `scripts/inspector/index.ts` → registration site (lines 68-83) ✅
- `scripts/cody/cody-utils` → CodyInput with complexityOverride ✅
- `scripts/cody/cli-parser` → --complexity flag, COMPLEXITY env var ✅
- `.github/workflows/cody.yml` → Run Cody step env vars (lines 417-450) ✅
- `opencode.json` → all 20 agents with .model field ✅

## Constants Reference
- Stage complexity thresholds: gap=35, clarify=60, architect=10, plan-gap=50, review=30, docs=30
- Complexity 65 → all stages run (above every threshold)
- Profile: complexity ≥ 35 → standard
- Complexity tiers: 1-9 trivial, 10-19 simple, 20-34 moderate, 35-49 complex, 50-100 very_complex
- Inspector cycle: 5 min (288 cycles ≈ 24h)
