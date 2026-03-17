# Codebase Context: improve-gate-questions

## Files to Modify
- `.opencode/agents/taskify.md` (lines 57-93) — rewrite review_questions prompt guidance
- `scripts/cody/clarify-workflow.ts` (lines 270-346) — add isImplementationQuestion filter, modify formatGateComment

## Files to Create
- `tests/unit/cody/clarify-workflow.test.ts` (NEW) — unit tests for isImplementationQuestion filter

## Files to Read (reference patterns)
- `.tasks/*/task.json` — real examples of review_questions arrays (13 non-empty found)
- `.opencode/agents/architect.md` — shows what architect already discovers (confirms overlap)
- `scripts/cody/pipeline-utils.ts` (lines 160-178) — TaskDefinition interface with review_questions field

## Key Signatures
- `formatGateComment(controlMode, riskLevel, taskType, confidence, scope, taskSummary, gatePoint, planContent?, assumptions?, reviewQuestions?)` from `scripts/cody/clarify-workflow.ts` (line 272)
- `interface TaskDefinition { review_questions?: string[] }` from `scripts/cody/pipeline-utils.ts` (line 171)
- `handleGateApproval(input, taskDir, gatePoint, taskDef)` from `scripts/cody/clarify-workflow.ts` (line 359)

## Integration Points
- `formatGateComment` is called from `handleGateApproval` (line ~460) which is called from `check-gate` post-action in `scripts/cody/pipeline/post-actions.ts` (line 114)
- `review_questions` are read from `task.json` in `handleGateApproval` (line 458)
- The taskify agent writes `task.json` including `review_questions` — the prompt change affects LLM output quality
- Gate comments are posted to GitHub issues via `scripts/cody/github-api.ts`

## Imports Verified
- `scripts/cody/clarify-workflow.ts` — exports `handleGateApproval`, `formatGateComment` is internal ✅
- `scripts/cody/pipeline-utils.ts` — exports `TaskDefinition` interface ✅
- No new dependencies needed — regex patterns are native JS ✅

## Test Patterns
- No existing test file for `clarify-workflow.ts` found — creating new
- Test runner: `pnpm vitest run`
- Test location convention: `tests/unit/cody/` for pipeline unit tests
