# Build Agent Report: Brain Server Phase 2

## Changes

### New Files Created

1. **`scripts/cody/brain-client.ts`** — MCP client + Claude API wrapper
   - `connectBrain()` — Connects to remote brain via SSE MCP
   - `isBrainHealthy()` — Health check with 5s timeout
   - `runBrain()` — Tool-use loop with Claude API + MCP tools

2. **`scripts/cody/brain-health.ts`** — Health check utility
   - `isBrainAvailable()` — Returns false if URL undefined/empty or server unreachable

3. **`scripts/cody/architect-brain.ts`** — Brain-based architect stage
   - `runArchitectBrain()` — Replaces taskify+gap+architect using remote brain
   - Parses `task.json` and `plan.md` from brain output

4. **`scripts/cody/review-brain.ts`** — Brain-based review stage
   - `runReviewBrain()` — Reviews code changes using remote brain
   - Produces `review.md` with blast radius and static analysis

5. **`scripts/cody/modes/brain-full.ts`** — Brain-aware full mode handler
   - Checks `BRAIN_SERVER_URL` availability
   - If brain available: remote architect → local impl → remote review
   - Falls back to standard pipeline if brain unavailable

### Modified Files

1. **`scripts/cody/modes/index.ts`** — Added `runBrainFullMode` export

2. **`scripts/cody/entry.ts`** — Added brain routing for 'full' mode
   - Imported `runBrainFullMode` from modes
   - Changed 'full' case to use `runBrainFullMode` instead of `runFullMode`

3. **`opencode.json`** — Added Neuron MCP server configuration
   - `"neuron"` entry with SSE type and hardcoded Tailscale IP

### Dependencies Added

- `@modelcontextprotocol/sdk@^1.25.2` — MCP client SDK
- `@anthropic-ai/sdk@^0.80.0` — Claude API SDK

## Tests Written

- `tests/unit/scripts/cody/brain-client.test.ts` — 4 tests (isBrainHealthy)
- `tests/unit/scripts/cody/brain-health.test.ts` — 6 tests (health check scenarios)
- `tests/unit/scripts/cody/architect-brain.test.ts` — 4 tests (parse task.json/plan.md)
- `tests/unit/scripts/cody/review-brain.test.ts` — 5 tests (review formatting)

## Deviations

- None — plan followed exactly

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: 19 brain-related tests passing

## Next Steps

Phase 3 (Auth & Observability) is defined in `docs/brain-server/04-phase2-auth-observability.md`
