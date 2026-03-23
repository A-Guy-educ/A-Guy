# Pipeline Observer: Detailed Plan (v2)

---

## Part 1: PRD (Product Requirements Document)

---

### 1.1 Problem Statement

The Cody pipeline is experiencing **complexity accumulation**. Each new failure mode requires a new patch:

```
Failure X → Patch X
Failure Y → Patch Y
Failure Z → Patch Z
...
100+ patches → Pipeline is unreadable, unmaintainable
```

**Current failure handling:**
- `retryWith` for specific stage loops (verify → fix)
- `maxRetries` for agent retries
- `error-classifier.ts` for build error categorization
- Inline try/catch in `state-machine.ts`
- Various post-action error handlers

**The result:** 758-line `state-machine.ts`, hundreds of patches, impossible to reason about.

---

### 1.2 Goals

| Goal | Description |
|------|-------------|
| **Stop complexity spiral** | No more patches to `state-machine.ts` for failure handling |
| **Delegate to agent** | All complex failure handling goes to OpenCode agent |
| **Single responsibility** | Pipeline executes stages; Observer handles failures |
| **Observability** | All failure decisions logged for debugging |
| **Non-breaking** | Existing error handling stays; Observer is additive |

---

### 1.3 Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Replace existing retry logic | `retryWith`, `maxRetries` still handle simple cases |
| Rewrite state machine | Observer sits alongside existing code |
| Handle all failures automatically | Agent can escalate to human |
| Real-time dashboard | Logging + status.json sufficient for v1 |

---

### 1.4 Success Criteria

| # | Criterion | How Measured |
|---|-----------|--------------|
| 1 | No new patches for failures | After 1 month, state-machine.ts unchanged |
| 2 | Complex failures handled by agent | Agent successfully fixes or escalates for edge cases |
| 3 | Pipeline stays simple | Line count of state-machine.ts doesn't grow |
| 4 | Failure decisions traceable | All decisions logged in status.json |
| 5 | Non-breaking | Existing pipelines work without Observer |

---

### 1.5 User Stories

| # | Story |
|---|-------|
| **S1** | As a pipeline, when a stage fails with a complex error, I want to delegate handling to an agent so I don't need to know how to handle every failure |
| **S2** | As a developer, when a pipeline fails in an unexpected way, I want the failure delegated to an agent that can investigate and fix, so I don't have to manually intervene |
| **S3** | As an operator, when the agent cannot fix a failure, I want to be notified and have the pipeline paused, so I can decide what to do |
| **S4** | As a developer debugging, I want all failure decisions logged, so I can understand why the pipeline made certain choices |

---

### 1.6 Out of Scope (v1)

- Dashboard/UI for failure monitoring
- Automatic retry policies based on learned patterns
- Multi-pipeline coordination
- Caching agent investigations for similar failures
- Human-in-the-loop approval workflow (agent decides to escalate, not human approves decisions)

---

## Part 2: Technical Specification

---

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Pipeline Run                                  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    State Machine                               │   │
│  │                                                                │   │
│  │   runStage() → success → next stage                          │   │
│  │              → failure → tryExistingHandling()                 │   │
│  │                             ↓                                   │   │
│  │                      Can handle? → Yes → apply handling        │   │
│  │                             ↓ No                              │   │
│  │                        Observer.handle()                       │   │
│  │                                                                │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                    │                                 │
│                                    ▼                                 │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                       Observer                                 │   │
│  │                                                                │   │
│  │   Responsibility: Handle complex failures via OpenCode agent    │   │
│  │                                                                │   │
│  │   - Receives failure context                                  │   │
│  │   - Delegates to SAME agent that ran the stage                 │   │
│  │   - Agent investigates + decides: retry / escalate / halt      │   │
│  │   - Observer applies agent's decision                          │   │
│  │                                                                │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                    │                                 │
│                                    ▼                                 │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    OpenCode Session                            │   │
│  │                                                                │   │
│  │   Agent (e.g., build agent):                                  │   │
│  │   - Receives failure task from Observer                        │   │
│  │   - Investigates error context                                 │   │
│  │   - Writes decision to file                                   │   │
│  │   - Observer reads file to get decision                        │   │
│  │                                                                │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Key Design Decisions (v2)

| Decision | Rationale |
|----------|-----------|
| **Agent writes decision file** | LLM parsing of free-form text is fragile. Agent writes `.observer-decision.json`, Observer reads it. |
| **120s timeout** | 30s too tight for agent to read files, understand, fix. Match existing pipeline patterns. |
| **Max 2 Observer attempts** | Prevent infinite recursion. If agent's fix causes new failure, auto-escalate after 2 tries. |
| **No confidence field** | LLM confidence scores aren't calibrated. Action + reason is sufficient. |
| **Agent discovers relevant files** | Don't pre-populate `relevantFiles`. Agent is capable of discovering what it needs. |
| **2 files only for v1** | `types.ts` + `observer.ts`. Extract prompt to separate file later if needed. |

---

### 2.3 Observer Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Receive** | Get failure context from state machine |
| **Delegate** | Send failure to same OpenCode agent that ran the stage |
| **Wait (sync)** | Pipeline is PAUSED while Observer waits for agent (120s timeout) |
| **Read** | Agent writes decision to file, Observer reads it |
| **Apply** | Execute agent's decision (retry/escalate/halt) |
| **Log** | Record decision in status.json for audit trail |

---

### 2.4 Agent Responsibilities (Failure Handling Task)

When Observer delegates, the agent:

| Step | Action |
|------|--------|
| 1 | **Receive** failure context (error, stage, attempt, taskDir) |
| 2 | **Investigate** - read error output, understand root cause, discover relevant files |
| 3 | **Fix** - if fixable, apply the fix |
| 4 | **Write decision file** - `.observer-decision.json` in taskDir |
| 5 | **Exit** - Observer reads decision file and continues |

---

### 2.5 Decision Types

| Decision | Meaning | Observer Action |
|----------|---------|----------------|
| `retry` | Agent fixed the issue | Mark stage pending, pipeline resumes |
| `escalate` | Agent cannot fix, needs human | Pause pipeline, notify (Slack/GitHub) |
| `halt` | Fundamental problem, stop pipeline | Mark pipeline failed, exit |

---

### 2.6 Data Flow (v2)

```
Stage failure occurs
        │
        ▼
┌─────────────────┐
│  StageFailure   │
│  - stageName    │
│  - error        │
│  - attempt      │
│  - taskDir      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Observer       │
│  .handle()      │
└────────┬────────┘
         │
         │ "Handle this failure"
         │ Pipeline PAUSED
         ▼
┌─────────────────┐
│  OpenCode       │
│  Same Agent     │
│                 │
│  Investigates    │
│  Applies fix    │
│  Writes:        │
│  .observer-     │
│  decision.json  │
└────────┬────────┘
         │
         │ (after agent exits or timeout)
         ▼
┌─────────────────┐
│  Observer       │
│  Reads decision │
│  file           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Apply:         │
│  retry/escalate/│
│  halt          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Pipeline       │
│  Resumes or     │
│  Exits          │
└─────────────────┘
```

---

### 2.7 Decision File Schema

Agent writes to `{taskDir}/.observer-decision.json`:

```json
{
  "action": "retry",
  "reason": "Fixed TypeScript error in src/foo.ts",
  "fix": {
    "description": "Fixed type mismatch in calculateTotal function",
    "filesModified": ["src/foo.ts"]
  }
}
```

Or for escalation:

```json
{
  "action": "escalate",
  "reason": "Context overflow - needs human to simplify requirements"
}
```

Or for halt:

```json
{
  "action": "halt",
  "reason": "Invalid task.json - fundamental data quality issue"
}
```

---

### 2.8 Context Passed to Agent

```typescript
interface FailureContext {
  stageName: string           // e.g., "build"
  error: {
    message: string          // "TS2345: type error..."
    stack?: string           // optional stack trace
  }
  attempt: number            // which attempt (1, 2, 3...)
  maxAttempts: number        // max retries allowed
  taskDir: string            // agent can discover files here
  observerAttempt: number     // Observer retry count (1 or 2 max)
}
```

---

### 2.9 Pipeline State During Observer Wait

**Stage state = `"observing"`**

While Observer waits for agent response:
- Stage is marked `"observing"` (not `"failed"`, not `"running"`)
- Pipeline is `"running"` but loop is blocked
- status.json shows `stage.state = "observing"`

This provides observability: anyone looking at status.json sees the stage is being handled by Observer.

---

### 2.10 Escalation Notification

When agent returns `escalate`:

| Channel | Implementation |
|---------|----------------|
| **GitHub issue comment** | POST to GitHub API - adds comment to issue |
| **status.json** | `observerHistory` entry with escalate action |
| **Slack** | Future: webhook notification (v1 is GitHub comment only) |

Escalation does NOT auto-resume. Pipeline stays paused until human manually intervenes (or pipeline is killed).

---

### 2.11 Recursion Prevention

```
Agent fix applied → Stage retries → Fails again
        │
        ▼
Observer.handle() called again
        │
        │ observerAttempt = 2 (> MAX_OBSERVER_ATTEMPTS)
        │
        ▼
Auto-escalate (don't call agent again)
        │
        ▼
Human notified, pipeline paused
```

**MAX_OBSERVER_ATTEMPTS = 2**

After 2 Observer attempts, auto-escalate regardless of whether agent thinks it can fix.

---

### 2.12 Existing Handling (Preserved)

| Mechanism | Purpose | Status |
|-----------|---------|--------|
| `maxRetries` | Agent-level retries | ✅ Kept |
| `retryWith` | verify→fix loop | ✅ Kept |
| `advisory` flag | Non-blocking failures | ✅ Kept |
| `shouldSkip` | Conditional skipping | ✅ Kept |
| `error-classifier.ts` | Build error categorization | ✅ Kept |
| Post-action validation | Content validation | ✅ Kept |

---

### 2.13 When Observer Is Called

Observer is called **only when existing handling cannot handle the failure**.

```
Stage fails
    │
    ├─ tryExistingHandling()
    │     │
    │     ├─ retryWith configured? → retry
    │     ├─ maxRetries not exceeded? → retry  
    │     ├─ advisory stage? → continue
    │     └─ None apply? → Observer.handle()
    │
    └─ Observer.handle()
```

---

### 2.14 Logging & Audit Trail

All Observer decisions are logged to `status.json`:

```typescript
// In status.json
{
  "state": "running",
  "stages": { ... },
  "observerHistory": [
    {
      "stage": "build",
      "observerAttempt": 1,
      "error": "TS2345: Argument type mismatch",
      "action": "retry",
      "reason": "Fixed TypeScript error - agent applied fix",
      "agentName": "build",
      "timestamp": "2026-03-22T10:30:00Z",
      "fixApplied": {
        "description": "Fixed type mismatch in foo.ts",
        "filesModified": ["src/foo.ts"]
      }
    },
    {
      "stage": "build",
      "observerAttempt": 2,
      "error": "TS2345: Still failing after fix",
      "action": "escalate",
      "reason": "Max Observer attempts reached - needs human review",
      "agentName": "build",
      "timestamp": "2026-03-22T10:32:00Z"
    }
  ]
}
```

---

## Part 3: Implementation

---

### 3.1 New Files (v2 - reduced to 2)

| File | Purpose |
|------|---------|
| `scripts/cody/pipeline/observer/types.ts` | Type definitions |
| `scripts/cody/pipeline/observer/observer.ts` | Observer class + inline prompt template |

---

### 3.2 Modified Files

| File | Change |
|------|--------|
| `scripts/cody/engine/state-machine.ts` | Call Observer on unhandled failures |
| `scripts/cody/engine/status.ts` | Add `observerHistory` to status.json schema |

---

### 3.3 Observer Class API

```typescript
// types.ts
export interface StageFailure {
  stageName: StageName
  error: Error
  attempt: number
  maxAttempts: number
  taskDir: string
}

export interface ObserverResult {
  action: 'retry' | 'escalate' | 'halt'
  reason: string
  fix?: {
    description: string
    filesModified: string[]
  }
  observerAttempt: number
}

export interface ObserverDecision {
  action: 'retry' | 'escalate' | 'halt'
  reason: string
  fix?: {
    description: string
    filesModified: string[]
  }
}
```

```typescript
// observer.ts
export class PipelineObserver {
  private static readonly MAX_OBSERVER_ATTEMPTS = 2
  private static readonly TIMEOUT_MS = 120_000 // 120s

  constructor(private session: OpenCodeSession) {}

  async handle(failure: StageFailure): Promise<ObserverResult> {
    const observerAttempt = this.getObserverAttempt(failure)
    
    // Check recursion cap
    if (observerAttempt > PipelineObserver.MAX_OBSERVER_ATTEMPTS) {
      return this.autoEscalate(failure, 'Max Observer attempts exceeded')
    }

    // Mark stage as observing
    this.updateStageState(failure.taskDir, failure.stageName, 'observing')

    // Delegate to agent with timeout
    const result = await this.withTimeout(
      this.delegateToAgent(failure, observerAttempt),
      PipelineObserver.TIMEOUT_MS
    )

    // Log decision
    this.logDecision(failure, result, observerAttempt)

    return { ...result, observerAttempt }
  }

  private async delegateToAgent(
    failure: StageFailure,
    observerAttempt: number
  ): Promise<ObserverResult> {
    // Write failure context file
    const contextFile = path.join(failure.taskDir, '.observer-context.json')
    fs.writeFileSync(contextFile, JSON.stringify({
      stageName: failure.stageName,
      error: failure.error.message,
      attempt: failure.attempt,
      maxAttempts: failure.maxAttempts,
      observerAttempt,
      taskDir: failure.taskDir,
    }, null, 2))

    // Run agent with failure handling task
    await this.session.runAgent(failure.stageName, {
      task: 'handle_observer_failure',
      context: { taskDir: failure.taskDir }
    })

    // Read decision file
    const decisionFile = path.join(failure.taskDir, '.observer-decision.json')
    if (!fs.existsSync(decisionFile)) {
      throw new Error('Agent did not write decision file')
    }

    const decision: ObserverDecision = JSON.parse(fs.readFileSync(decisionFile, 'utf-8'))
    
    return {
      action: decision.action,
      reason: decision.reason,
      fix: decision.fix,
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Observer timeout')), ms)
      )
    ])
  }

  private autoEscalate(failure: StageFailure, reason: string): ObserverResult {
    return {
      action: 'escalate',
      reason: `Auto-escalated: ${reason}`,
    }
  }

  private logDecision(failure: StageFailure, result: ObserverResult, observerAttempt: number): void {
    // Write to status.json observerHistory
  }

  private updateStageState(taskDir: string, stageName: StageName, state: string): void {
    // Update stage state to 'observing'
  }
}
```

---

### 3.4 Agent Prompt (Inline in Observer)

```typescript
const FAILURE_HANDLING_PROMPT = `
## Task: Handle Stage Failure

Stage "{stageName}" failed during pipeline execution.

### Error Context
See .observer-context.json for full details.

### Your Task

1. Read .observer-context.json to understand the failure
2. Investigate the error
3. If fixable:
   - Apply the fix
   - Write .observer-decision.json with action: "retry"
4. If not fixable:
   - Write .observer-decision.json with action: "escalate" and reason
5. If fundamentally broken:
   - Write .observer-decision.json with action: "halt" and reason

### Decision File Format
Write to {taskDir}/.observer-decision.json:
\`\`\`json
{
  "action": "retry|escalate|halt",
  "reason": "explanation",
  "fix": {
    "description": "what was fixed",
    "filesModified": ["file1", "file2"]
  }
}
\`\`\`

### Rules
- Do NOT write partial JSON - write complete valid JSON
- If you can't fix, escalate - don't guess
- You have 120 seconds before timeout
- Write the decision file BEFORE exiting
`
```

---

## Part 4: Implementation Steps

---

### Step 1: Create Types (`observer/types.ts`)

Define `StageFailure`, `ObserverResult`, `ObserverDecision` interfaces.

### Step 2: Create Observer Class (`observer/observer.ts`)

Implement:
- `handle()` method
- `delegateToAgent()` method
- `withTimeout()` helper (120s)
- `autoEscalate()` for recursion cap
- `logDecision()` for audit trail

### Step 3: Update Status Schema (`status.ts`)

Add `observerHistory` field and `stage.state = "observing"` enum value.

### Step 4: Integrate with State Machine (`state-machine.ts`)

Add Observer call in `executeSingleStep()` catch block, after `tryExistingHandling()`.

### Step 5: Test with Build Stage Only

Start with `build` stage only. Verify:
- Observer called on build failure after existing handling fails
- Same build agent handles failure
- Agent writes decision file
- Observer reads and applies

### Step 6: Extend to All Stages

Once build stage works, extend Observer to all stages.

---

## Part 5: Resolved Questions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Timeout | **120s** (not 30s) |
| 2 | Invalid agent response | Agent must write file. Missing file = auto-escalate. |
| 3 | Agent fix persistence | File writes persist. Pipeline restart picks them up. |
| 4 | Response parsing | Agent writes JSON file, Observer reads it. No LLM parsing. |
| 5 | Recursion | **Max 2 Observer attempts per stage**, then auto-escalate |
| 6 | Confidence field | **Dropped** - not useful |
| 7 | relevantFiles | **Agent discovers** - don't pre-populate |
| 8 | File count | **2 files only** (types + observer) |
| 9 | Escalation notify | **GitHub issue comment** + status.json |
| 10 | Pipeline state during wait | **Stage = "observing"** |
| 11 | Confidence field | Dropped |

---

## Part 6: Summary

| Aspect | Description |
|--------|-------------|
| **What** | Observer delegates complex failures to OpenCode agent |
| **Why** | Stop patch spiral, keep pipeline simple |
| **How** | Same agent handles its own failures; writes decision file |
| **Timeout** | 120s |
| **Recursion cap** | 2 attempts max, then auto-escalate |
| **Files** | 2 (types.ts + observer.ts) |
| **Escalation** | GitHub issue comment + status.json |
| **Breaking?** | No - existing handling preserved |
| **Scope** | Start with build stage only |
