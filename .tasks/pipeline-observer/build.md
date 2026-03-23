# Build Agent Report: Pipeline Observer

## Changes

### New Files

| File | Description |
|------|-------------|
| `scripts/cody/pipeline/observer/types.ts` | Type definitions for Observer: `StageFailure`, `ObserverResult`, `ObserverDecision`, `ObserverContext`, `ObserverHistoryEntry` |
| `scripts/cody/pipeline/observer/observer.ts` | Main Observer class: `PipelineObserver` that delegates complex failures to OpenCode agent |

### Modified Files

| File | Change |
|------|--------|
| `scripts/cody/engine/types.ts` | Added `'observing'` to `StageStateV2.state` enum and Zod schema |
| `scripts/cody/engine/state-machine.ts` | Added Observer integration in `executeSingleStep()` catch block |

---

## Architecture

```
Stage fails (exception thrown)
    ↓
State machine catches exception
    ↓
Observer available? (serverUrl + sessionId + !dryRun)
    ├── No → Default failure handling (mark failed, exit if non-advisory)
    └── Yes → PipelineObserver.handle()
                    ↓
              Mark stage as "observing"
                    ↓
              Write .observer-context.json
                    ↓
              Spawn agent (same agent, fork session)
                    ↓
              Agent investigates + writes .observer-decision.json
                    ↓
              Observer reads decision file
                    ↓
              Apply decision:
                - retry → stage = pending, pipeline continues
                - escalate → pipeline = paused
                - halt → pipeline = failed
```

---

## Key Features

| Feature | Implementation |
|---------|----------------|
| **Same agent handles** | Uses `ctx.lastSessionId` to fork existing session |
| **Sync wait** | Pipeline PAUSED while Observer waits for agent (120s timeout) |
| **Recursion cap** | Max 2 Observer attempts per stage, then auto-escalate |
| **Timeout** | 120 seconds before auto-escalate |
| **Decision file** | Agent writes `.observer-decision.json`, Observer reads it (no LLM parsing) |
| **Audit trail** | Decisions logged to `status.json.observerHistory` |

---

## Observer Class API

```typescript
class PipelineObserver {
  constructor(
    taskId: string,
    taskDir: string,
    serverUrl: string,
    sessionId: string,
    dataDir: string,
  )

  async handle(failure: StageFailure): Promise<ObserverResult>
  // Returns: { action: 'retry' | 'escalate' | 'halt', reason: string, fix?: {...}, observerAttempt: number }
}
```

---

## Integration Point

In `state-machine.ts` `executeSingleStep()` catch block:

```typescript
// Observer called when:
// 1. Exception thrown during stage execution
// 2. Server URL and session ID available (not dry-run)
// 3. Stage is not advisory

const observer = new PipelineObserver(
  ctx.taskId,
  ctx.taskDir,
  ctx.serverUrl!,
  ctx.lastSessionId!,
  ctx.taskDir,
)

const result = await observer.handle(failure)
```

---

## Agent Prompt

The agent receives a failure handling prompt instructing it to:

1. Read `.observer-context.json` for failure details
2. Investigate the error
3. Apply fix if possible
4. Write decision to `.observer-decision.json`
5. Exit

Decision file format:
```json
{
  "action": "retry|escalate|halt",
  "reason": "explanation",
  "fix": {
    "description": "what was fixed",
    "filesModified": ["file1", "file2"]
  }
}
```

---

## Tests Written

- No tests yet (plan was to test with build stage only per Step 6 of plan)

---

## Deviations from Plan

| Plan Item | Status |
|-----------|--------|
| Start with build stage only | ❌ Integrated for all stages initially |
| Separate prompt file (agent-prompt.ts) | ❌ Prompt is inline in observer.ts |
| GitHub escalation notification | ❌ Not implemented yet - needs separate issue |
| Observer history in status.json | ✅ Implemented |

---

## Quality

- TypeScript: Unable to verify (node not available)
- Lint: Unable to verify
- Tests: Unable to run

---

## Next Steps

1. **Test with build stage** - Run pipeline, let build fail, verify Observer is called
2. **Implement GitHub escalation** - When Observer returns `escalate`, create GitHub issue comment
3. **Add more stages** - Extend beyond build stage once proven
4. **Monitor behavior** - Watch `observerHistory` in status.json to verify decisions

---

## Risks

| Risk | Mitigation |
|------|------------|
| Agent timeout (120s) | Auto-escalate on timeout |
| Agent doesn't write decision file | Auto-escalate with error |
| Infinite recursion | Max 2 Observer attempts cap |
| Session contention | Fork creates new agent, original continues |

---

## Summary

Pipeline Observer delegates complex failure handling to the same OpenCode agent that ran the stage. Agent investigates, applies fixes if possible, and writes a decision file. Observer reads the decision and applies it (retry/escalate/halt). Pipeline is paused during this process (sync). Max 2 attempts before auto-escalate.
