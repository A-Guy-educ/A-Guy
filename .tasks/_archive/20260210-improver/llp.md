# LLP: Auditor Agent (v1.0)

> Implements spec: `.tasks/20260210-improver/spec.md`
> Prerequisite: `scripts/pipeline.ts` (pipeline state detector) must be built first — see `.tasks/pipeline-state-detector/spec.md`

## Decisions (Locked)

| Decision                    | Choice                                        | Rationale                                                             |
| --------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Target orchestration system | OpenCode Pipeline (`.opencode/PIPELINE.md`)   | More rigorous, formally defined state machine                         |
| Pipeline integration        | New STATE 5: AUDIT between VERIFY and DONE    | Spec requires mandatory gate; a dedicated state enforces this         |
| Persistence location        | `.tasks/<task-id>/runs/<run-id>/auditor.json` | Co-located with task artifacts, matches existing `.tasks/` convention |
| Scope                       | Both Phase 1 (success) + Phase 2 (failure)    | Shared schema/persistence; Phase 2 adds ~30% incremental work         |
| Pipeline detector           | Separate task (prerequisite)                  | Different concern, own task lifecycle                                 |

---

## Overview

Create the Auditor agent that:

1. Runs as a mandatory pipeline gate (STATE 5: AUDIT) on every task run
2. Analyzes the run for friction signals (success) or failure diagnosis (failure)
3. Produces exactly one concrete improvement artifact per run
4. Persists structured output to `.tasks/<task-id>/runs/<run-id>/auditor.json`
5. Blocks pipeline closure if output is missing, invalid, or `canClose=false`

---

## Step 1: Define Auditor Output Schema

**Why**: The spec requires machine-readable structured output. A Zod schema provides runtime validation for the pipeline state detector (when it validates auditor output) and serves as the authoritative contract.

**File to create**: `schemas/auditor-output.schema.ts`

```typescript
import { z } from 'zod'

export const ImprovementTypeSchema = z.enum([
  'DOC',
  'INDEX',
  'GUARDRAIL',
  'PROMPT',
  'AUTOMATION',
  'NAMING_STRUCTURE',
])

export const ClassificationSchema = z.enum(['SPEC_PROMPT', 'CONTEXT', 'EXECUTION', 'UNKNOWN'])

export const RunStateSchema = z.enum(['SUCCESS', 'FAILURE', 'ABORTED'])

export const RetrySafeSchema = z.enum(['YES', 'NO', 'UNKNOWN'])

export const ChosenImprovementSchema = z.object({
  type: ImprovementTypeSchema,
  title: z.string().min(1).describe('Short imperative title'),
  rationale: z.string().min(1).max(500).describe('1-2 sentences'),
  whereItLives: z.array(z.string().min(1)).min(1).describe('File path(s) or rule identifier'),
  acceptanceCriteria: z
    .array(z.string().min(1))
    .min(2)
    .max(5)
    .describe('Testable/verifiable checks'),
})

// Phase 2: Failure-specific fields
export const FailureAnalysisSchema = z.object({
  rootCause: z.string().min(1).max(300).describe('One concrete sentence'),
  earliestMissedSignal: z.string().min(1).max(300),
  responsibilityBoundary: z.enum(['orchestrator', 'verifier', 'executor', 'planner', 'spec']),
})

export const AuditorOutputSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  runState: RunStateSchema,
  classification: ClassificationSchema,
  processDelta: z.array(z.string().min(1)).min(1).max(4).describe('Short bullets on what happened'),
  chosenImprovement: ChosenImprovementSchema,
  canClose: z.boolean(),
  followUpRequired: z.boolean(),
  retrySafe: RetrySafeSchema,
  notes: z.array(z.string()).max(3).optional(),
  // Phase 2: present only on FAILURE/ABORTED runs
  failureAnalysis: FailureAnalysisSchema.optional(),
})

export type AuditorOutput = z.infer<typeof AuditorOutputSchema>
export type ChosenImprovement = z.infer<typeof ChosenImprovementSchema>
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>
```

**Also create**: `schemas/auditor-output.schema.json`

Generate a JSON Schema version from the Zod schema (using `zod-to-json-schema`) for non-TypeScript consumers and documentation. Place it alongside the `.ts` file.

**Validation**: `pnpm tsc --noEmit` passes. The schema matches every field from spec section "Outputs (Shared)".

---

## Step 2: Define Run Bundle Schema

**Why**: The Auditor needs a well-defined input contract. The "Run Bundle" from the spec must be formalized so the orchestrator knows exactly what to collect.

**File to create**: `schemas/run-bundle.schema.ts`

```typescript
import { z } from 'zod'

export const AgentOutputSummarySchema = z.object({
  agentName: z.string(),
  state: z.enum(['completed', 'failed', 'skipped']),
  summary: z.string().max(1000),
  filesModified: z.array(z.string()).optional(),
  duration: z.string().optional(),
})

export const RunBundleSchema = z.object({
  // Required
  runId: z.string().min(1),
  taskId: z.string().min(1),
  taskTitle: z.string().min(1),
  taskSpecPath: z.string().min(1),
  orchestratorTimeline: z.array(
    z.object({
      agent: z.string(),
      startedAt: z.string().datetime(),
      completedAt: z.string().datetime().optional(),
      state: z.enum(['completed', 'failed', 'skipped']),
    }),
  ),
  agentOutputs: z.array(AgentOutputSummarySchema).min(1),
  finalState: z.enum(['SUCCESS', 'FAILURE', 'ABORTED']),
  primaryArtifacts: z.object({
    diffSummary: z.string().optional(),
    filesChanged: z.array(z.string()).optional(),
    docsChanged: z.array(z.string()).optional(),
  }),
  // Optional
  fullLogs: z.string().optional(),
  toolErrors: z.array(z.string()).optional(),
  ciOutput: z.string().optional(),
  costMetrics: z
    .object({
      totalTokens: z.number().optional(),
      duration: z.string().optional(),
    })
    .optional(),
})

export type RunBundle = z.infer<typeof RunBundleSchema>
```

**Validation**: `pnpm tsc --noEmit` passes.

---

## Step 3: Create Persistence Layer

**Why**: Auditor outputs must be durable, linkable to task IDs, and queryable for aggregation.

**File to create**: `scripts/lib/auditor-persistence.ts`

```typescript
import fs from 'fs'
import path from 'path'
import { AuditorOutputSchema, type AuditorOutput } from '../../schemas/auditor-output.schema'

const TASKS_DIR = '.tasks'

/**
 * Resolve the run directory path for a given task and run.
 * Creates directories if they don't exist.
 */
export function resolveRunDir(taskId: string, runId: string): string {
  const runDir = path.join(TASKS_DIR, taskId, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  return runDir
}

/**
 * Write auditor output to the run directory.
 * Validates against schema before writing.
 * Returns the file path written.
 */
export function writeAuditorOutput(taskId: string, runId: string, output: AuditorOutput): string {
  // Validate before writing
  const parsed = AuditorOutputSchema.parse(output)

  const runDir = resolveRunDir(taskId, runId)
  const filePath = path.join(runDir, 'auditor.json')
  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
  return filePath
}

/**
 * Read and validate auditor output from a run directory.
 * Returns null if file doesn't exist or is invalid.
 */
export function readAuditorOutput(taskId: string, runId: string): AuditorOutput | null {
  const filePath = path.join(TASKS_DIR, taskId, 'runs', runId, 'auditor.json')
  if (!fs.existsSync(filePath)) return null

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return AuditorOutputSchema.parse(raw)
  } catch {
    return null
  }
}

/**
 * List all runs for a task, sorted by runId (timestamp-based).
 */
export function listRuns(taskId: string): string[] {
  const runsDir = path.join(TASKS_DIR, taskId, 'runs')
  if (!fs.existsSync(runsDir)) return []
  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/**
 * Generate a run ID based on timestamp.
 * Format: run-YYYYMMDD-HHMMSS
 */
export function generateRunId(): string {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `run-${ts.slice(0, 8)}-${ts.slice(8, 14)}`
}
```

**Resulting directory structure example**:

```
.tasks/20260210-improver/
  spec.md
  llp.md
  runs/
    run-20260210-153000/
      auditor.json
    run-20260211-091500/
      auditor.json
```

**Validation**: `pnpm tsc --noEmit` passes. Manually test `generateRunId()` output format.

---

## Step 4: Create the Auditor Agent Definition

**Why**: The auditor needs to exist as an OpenCode agent with a prompt that enforces the spec's constraints.

**File to create**: `.opencode/agents/auditor.md`

````markdown
---
name: auditor
description: Post-run improvement extractor. Analyzes task runs and produces one concrete process improvement.
mode: primary
tools:
  bash: true
  read: true
  write: true
  edit: false
---

# AUDITOR AGENT (Process Improver)

You are the **Auditor**. Your job is to analyze a completed task run and produce
**exactly one** concrete, durable process improvement.

You do NOT implement code changes.
You do NOT redesign architecture.
You do NOT generate multiple improvements.
You do NOT replace verification or testing.

## Inputs

You receive a **Run Bundle** containing:

- Task ID, title, and spec path
- Orchestrator timeline (agent sequence + timestamps)
- Agent output summaries
- Final state (SUCCESS / FAILURE / ABORTED)
- Primary artifacts (diff summary, files changed, docs changed)
- Optional: full logs, tool errors, CI output

## What You Must Do

### On SUCCESS runs:

1. Evaluate friction signals:
   - Did agents ask repeated questions?
   - Did the orchestrator retry due to preventable issues?
   - Did the verifier fail on first attempt?
   - Was "tribal knowledge" required that isn't documented?

2. Evaluate spec quality:
   - Were requirements ambiguous?
   - Were guardrails missing?
   - Were acceptance criteria too weak?

3. Evaluate execution quality:
   - Did executors diverge from spec?
   - Were there inconsistent patterns?
   - Was time wasted on avoidable context hunting?

4. Choose exactly ONE improvement from these types:
   - DOC: documentation update
   - INDEX: index/catalog update
   - GUARDRAIL: new guardrail rule
   - PROMPT: agent prompt improvement
   - AUTOMATION: CI check / lint rule / script
   - NAMING_STRUCTURE: folder/file naming convention

### On FAILURE / ABORTED runs:

1. Classify the failure:
   - SPEC_PROMPT: unclear requirements, missing constraints, agents misinterpreted spec
   - CONTEXT: missing files/indexes, insufficient repo pointers, environment issues
   - EXECUTION: runtime errors, build failures, tool errors, implementation bugs
   - UNKNOWN: only if logs are insufficient (must then improve observability)

2. Provide failure analysis:
   - Root cause: one concrete sentence (not generic)
   - Earliest missed signal: what could have caught it earlier
   - Responsibility boundary: where it should have been caught

3. Determine retry safety:
   - YES: safe to retry after applying prevention improvement
   - NO: must revise spec/context before retry
   - UNKNOWN: must improve observability first

4. Choose exactly ONE preventive improvement

## Output Format (MANDATORY)

Write your output as JSON to: `.tasks/<taskId>/runs/<runId>/auditor.json`

The JSON must conform to the AuditorOutput schema:

```json
{
  "runId": "<run-id>",
  "taskId": "<task-id>",
  "runState": "SUCCESS | FAILURE | ABORTED",
  "classification": "SPEC_PROMPT | CONTEXT | EXECUTION | UNKNOWN",
  "processDelta": ["bullet 1", "bullet 2"],
  "chosenImprovement": {
    "type": "DOC | INDEX | GUARDRAIL | PROMPT | AUTOMATION | NAMING_STRUCTURE",
    "title": "Short imperative title",
    "rationale": "1-2 sentences explaining why",
    "whereItLives": ["path/to/file.md"],
    "acceptanceCriteria": ["Check 1", "Check 2"]
  },
  "canClose": true,
  "followUpRequired": false,
  "retrySafe": "YES | NO | UNKNOWN",
  "notes": ["optional note 1"],
  "failureAnalysis": {
    "rootCause": "One sentence",
    "earliestMissedSignal": "What could have caught it",
    "responsibilityBoundary": "verifier"
  }
}
```
````

## Hard Rules

- EXACTLY one chosenImprovement (never zero, never more than one)
- processDelta: 1-4 bullets maximum
- acceptanceCriteria: 2-5 items, each must be testable/verifiable
- whereItLives: must point to concrete repo artifact(s), never empty
- On FAILURE: failureAnalysis is REQUIRED (rootCause, earliestMissedSignal, responsibilityBoundary)
- On FAILURE: canClose MUST be false unless a follow-up task is being created
- On FAILURE: classification MUST NOT be UNKNOWN unless explicitly justified
- On SUCCESS: canClose may be true if the improvement is actionable as-is
- NEVER output fluffy, vague improvements. Be concrete.

````

**Validation**: Agent file has correct frontmatter (`name`, `description`, `mode`, `tools`). Validate with `.claude/scripts/ci/validate-agents.js` pattern (if applicable to `.opencode/` agents).

---

## Step 5: Update Pipeline State Machine

**Why**: The Auditor must be a mandatory gate in the pipeline. This adds STATE 5 (AUDIT) to `.opencode/PIPELINE.md`.

**File to update**: `.opencode/PIPELINE.md`

### 5a: Add AUDIT state between VERIFY PASS and DONE

**Insert after STATE 4 (VERIFY), before the existing DONE state:**

```markdown
### STATE 5 — AUDIT

Condition:

- Last verify result = PASS
- AND (no auditor output exists for current run OR auditor output has `canClose = false`)

Next Agent:

- `auditor`

Instruction:

- Analyze the full run (spec, plan, build diffs, verify report)
- Produce exactly one process improvement
- Write output to `.tasks/<task-id>/runs/<run-id>/auditor.json`
- Output must conform to AuditorOutput schema
- Do not modify code
- Do not commit

---

### STATE 5b — AUDIT FAILED → MANUAL INTERVENTION

Condition:

- Auditor output exists but `canClose = false`
- OR Auditor output schema validation failed

Action:

- STOP pipeline execution
- Report: "Auditor gate blocked closure. Reason: [canClose=false | schema invalid]"
- Follow-up task must be created before pipeline can close
````

### 5b: Renumber DONE state

The existing DONE state (currently STATE 6) stays as **STATE 6** but its condition changes:

**Before**:

```markdown
### STATE 6 — DONE

Condition:

- Last verify result = PASS
```

**After**:

```markdown
### STATE 6 — DONE

Condition:

- Last verify result = PASS
- AND auditor output exists for current run
- AND auditor output `canClose = true`
- AND auditor output schema is valid
```

### 5c: Update the CRITICAL LOOP diagram

**Before**:

```
STATE 3 (BUILD)
→ STATE 4 (VERIFY)
→ FAIL → STATE 3 (BUILD)
→ PASS → STATE 6 (DONE)
```

**After**:

```
STATE 3 (BUILD)
→ STATE 4 (VERIFY)
→ FAIL → STATE 3 (BUILD)
→ PASS → STATE 5 (AUDIT)
→ canClose=true → STATE 6 (DONE)
→ canClose=false → MANUAL INTERVENTION
```

### 5d: Add failure path to pipeline

The spec requires the Auditor to run on failure runs too. Add to **STATE 4 — VERIFY** section:

```markdown
### STATE 4b — VERIFY FAILED → AUDIT (then return to BUILD)

Condition:

- Last verify result = FAIL
- AND no auditor output exists for the current run yet

Next Agent:

- `auditor`

Instruction:

- Analyze the failed run
- Classify the failure (SPEC_PROMPT / CONTEXT / EXECUTION / UNKNOWN)
- Produce one preventive improvement
- Write output to `.tasks/<task-id>/runs/<run-id>/auditor.json`
- Auditor must set `retrySafe` field
- Do not modify code

Post-audit:

- If `retrySafe = YES` → return to STATE 3 (BUILD)
- If `retrySafe = NO` → STOP, manual intervention required
- If `retrySafe = UNKNOWN` → STOP, improve observability first
```

**Validation**: PIPELINE.md is self-consistent. State numbering is sequential. Top-down evaluation order is preserved. No dead states.

---

## Step 6: Write Run Bundle Collector Script

**Why**: The Auditor needs its input (the Run Bundle) to be assembled from various pipeline artifacts. This script collects everything into a single JSON file.

**File to create**: `scripts/lib/run-bundle-collector.ts`

```typescript
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { type RunBundle } from '../../schemas/run-bundle.schema'
import { generateRunId } from './auditor-persistence'

const TASKS_DIR = '.tasks'

interface CollectOptions {
  taskId: string
  finalState: 'SUCCESS' | 'FAILURE' | 'ABORTED'
  agentTimeline: Array<{
    agent: string
    startedAt: string
    completedAt?: string
    state: 'completed' | 'failed' | 'skipped'
    summary: string
    filesModified?: string[]
  }>
}

/**
 * Collect a Run Bundle from task artifacts and git state.
 * Writes to .tasks/<task-id>/runs/<run-id>/bundle.json
 */
export function collectRunBundle(opts: CollectOptions): {
  bundle: RunBundle
  runId: string
  bundlePath: string
} {
  const runId = generateRunId()
  const taskDir = path.join(TASKS_DIR, opts.taskId)

  // Read task spec
  const specPath = path.join(taskDir, 'spec.md')
  const taskTitle = extractTitle(specPath)

  // Get diff summary from git
  let diffSummary = ''
  let filesChanged: string[] = []
  try {
    diffSummary = execSync('git diff --stat HEAD~5..HEAD', {
      encoding: 'utf-8',
    }).trim()
    filesChanged = execSync('git diff --name-only HEAD~5..HEAD', {
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    diffSummary = '(git diff unavailable)'
  }

  // Find latest verify report
  const verifyReport = findLatestVerifyReport(taskDir)

  const bundle: RunBundle = {
    runId,
    taskId: opts.taskId,
    taskTitle,
    taskSpecPath: specPath,
    orchestratorTimeline: opts.agentTimeline.map((a) => ({
      agent: a.agent,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
      state: a.state,
    })),
    agentOutputs: opts.agentTimeline.map((a) => ({
      agentName: a.agent,
      state: a.state,
      summary: a.summary,
      filesModified: a.filesModified,
    })),
    finalState: opts.finalState,
    primaryArtifacts: {
      diffSummary,
      filesChanged,
      docsChanged: filesChanged.filter((f) => f.endsWith('.md') || f.includes('docs/')),
    },
    ciOutput: verifyReport || undefined,
  }

  // Write bundle
  const runDir = path.join(taskDir, 'runs', runId)
  fs.mkdirSync(runDir, { recursive: true })
  const bundlePath = path.join(runDir, 'bundle.json')
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), 'utf-8')

  return { bundle, runId, bundlePath }
}

function extractTitle(specPath: string): string {
  if (!fs.existsSync(specPath)) return '(untitled)'
  const content = fs.readFileSync(specPath, 'utf-8')
  const match = content.match(/^#\s+(.+)/m)
  return match?.[1] || '(untitled)'
}

function findLatestVerifyReport(taskDir: string): string | null {
  const files = fs.readdirSync(taskDir).filter((f) => f.startsWith('verify-'))
  if (files.length === 0) return null
  const latest = files.sort().pop()!
  return fs.readFileSync(path.join(taskDir, latest), 'utf-8')
}
```

**Validation**: `pnpm tsc --noEmit` passes. Bundle is self-contained JSON.

---

## Step 7: Create Auditor Validation Script

**Why**: The orchestrator must validate auditor output before allowing pipeline closure. This is the enforcement mechanism.

**File to create**: `scripts/validate-auditor.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Validate auditor output for a given task run.
 * Usage: pnpm tsx scripts/validate-auditor.ts --task-id=<id> --run-id=<id>
 * Exit codes: 0 = valid + canClose, 1 = invalid or canClose=false
 */

import { readAuditorOutput } from './lib/auditor-persistence'
import { AuditorOutputSchema } from '../schemas/auditor-output.schema'

const args = process.argv.slice(2)
const taskId = args.find((a) => a.startsWith('--task-id='))?.split('=')[1]
const runId = args.find((a) => a.startsWith('--run-id='))?.split('=')[1]

if (!taskId || !runId) {
  console.error('Usage: --task-id=<id> --run-id=<id>')
  process.exit(1)
}

const output = readAuditorOutput(taskId, runId)

if (!output) {
  console.error(`❌ Auditor output missing for ${taskId}/runs/${runId}`)
  process.exit(1)
}

// Schema validation (already done in readAuditorOutput, but be explicit)
const result = AuditorOutputSchema.safeParse(output)
if (!result.success) {
  console.error('❌ Auditor output schema invalid:')
  console.error(result.error.format())
  process.exit(1)
}

// Enforcement rules from spec
const data = result.data

// Rule: exactly one improvement
if (!data.chosenImprovement) {
  console.error('❌ Missing chosenImprovement')
  process.exit(1)
}

// Rule: whereItLives not empty
if (data.chosenImprovement.whereItLives.length === 0) {
  console.error('❌ whereItLives is empty')
  process.exit(1)
}

// Rule: on failure, must have failureAnalysis
if ((data.runState === 'FAILURE' || data.runState === 'ABORTED') && !data.failureAnalysis) {
  console.error('❌ Failure run missing failureAnalysis')
  process.exit(1)
}

// Rule: on failure, must have classification (not UNKNOWN unless justified)
if (
  (data.runState === 'FAILURE' || data.runState === 'ABORTED') &&
  data.classification === 'UNKNOWN' &&
  !data.notes?.some((n) => n.toLowerCase().includes('insufficient logs'))
) {
  console.error('❌ UNKNOWN classification on failure without justification in notes')
  process.exit(1)
}

// Gate check
if (!data.canClose) {
  console.log('⚠️  Auditor output valid but canClose=false')
  console.log(`   Follow-up required: ${data.followUpRequired}`)
  console.log(`   Retry safe: ${data.retrySafe}`)
  process.exit(1)
}

console.log('✅ Auditor output valid and canClose=true')
console.log(`   Improvement: [${data.chosenImprovement.type}] ${data.chosenImprovement.title}`)
console.log(`   Where: ${data.chosenImprovement.whereItLives.join(', ')}`)
process.exit(0)
```

**Add to package.json**:

```json
"validate-auditor": "pnpm tsx scripts/validate-auditor.ts"
```

**Validation**: Script exits 0 on valid+canClose=true, exits 1 otherwise.

---

## Step 8: Create Aggregation Index Script

**Why**: The spec requires an aggregated index for "Top recurring frictions" and "Top recurring failure classifications" — without this, the system has "memory of a fish" (spec line 341).

**File to create**: `scripts/aggregate-auditor.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Aggregate auditor outputs across all tasks into a summary index.
 * Usage: pnpm tsx scripts/aggregate-auditor.ts
 * Output: .tasks/_auditor-index.json
 */

import fs from 'fs'
import path from 'path'
import { AuditorOutputSchema, type AuditorOutput } from '../schemas/auditor-output.schema'

const TASKS_DIR = '.tasks'
const INDEX_PATH = path.join(TASKS_DIR, '_auditor-index.json')

interface AggregateIndex {
  generatedAt: string
  totalRuns: number
  successRuns: number
  failureRuns: number
  abortedRuns: number
  improvementsByType: Record<string, number>
  classificationBreakdown: Record<string, number>
  topFrictions: Array<{ title: string; count: number; taskIds: string[] }>
  recentImprovements: Array<{
    taskId: string
    runId: string
    type: string
    title: string
    whereItLives: string[]
    runState: string
  }>
}

function collectAllOutputs(): Array<AuditorOutput & { _taskId: string; _runId: string }> {
  const results: Array<AuditorOutput & { _taskId: string; _runId: string }> = []

  const taskDirs = fs
    .readdirSync(TASKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))

  for (const taskDir of taskDirs) {
    const runsDir = path.join(TASKS_DIR, taskDir.name, 'runs')
    if (!fs.existsSync(runsDir)) continue

    const runDirs = fs.readdirSync(runsDir, { withFileTypes: true }).filter((d) => d.isDirectory())

    for (const runDir of runDirs) {
      const filePath = path.join(runsDir, runDir.name, 'auditor.json')
      if (!fs.existsSync(filePath)) continue

      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const parsed = AuditorOutputSchema.parse(raw)
        results.push({ ...parsed, _taskId: taskDir.name, _runId: runDir.name })
      } catch {
        // Skip invalid entries
      }
    }
  }

  return results.sort((a, b) => a._runId.localeCompare(b._runId))
}

function aggregate(
  outputs: Array<AuditorOutput & { _taskId: string; _runId: string }>,
): AggregateIndex {
  const improvementsByType: Record<string, number> = {}
  const classificationBreakdown: Record<string, number> = {}
  const frictionMap = new Map<string, { count: number; taskIds: Set<string> }>()

  let successRuns = 0
  let failureRuns = 0
  let abortedRuns = 0

  for (const o of outputs) {
    // Count by state
    if (o.runState === 'SUCCESS') successRuns++
    else if (o.runState === 'FAILURE') failureRuns++
    else abortedRuns++

    // Count improvement types
    const type = o.chosenImprovement.type
    improvementsByType[type] = (improvementsByType[type] || 0) + 1

    // Count classifications
    classificationBreakdown[o.classification] = (classificationBreakdown[o.classification] || 0) + 1

    // Track friction patterns by improvement title similarity
    const key = o.chosenImprovement.title.toLowerCase()
    const existing = frictionMap.get(key) || { count: 0, taskIds: new Set<string>() }
    existing.count++
    existing.taskIds.add(o._taskId)
    frictionMap.set(key, existing)
  }

  const topFrictions = [...frictionMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([title, data]) => ({
      title,
      count: data.count,
      taskIds: [...data.taskIds],
    }))

  const recentImprovements = outputs
    .slice(-20)
    .reverse()
    .map((o) => ({
      taskId: o._taskId,
      runId: o._runId,
      type: o.chosenImprovement.type,
      title: o.chosenImprovement.title,
      whereItLives: o.chosenImprovement.whereItLives,
      runState: o.runState,
    }))

  return {
    generatedAt: new Date().toISOString(),
    totalRuns: outputs.length,
    successRuns,
    failureRuns,
    abortedRuns,
    improvementsByType,
    classificationBreakdown,
    topFrictions,
    recentImprovements,
  }
}

const outputs = collectAllOutputs()
const index = aggregate(outputs)
fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8')

console.log(`✅ Aggregated ${outputs.length} auditor outputs → ${INDEX_PATH}`)
console.log(
  `   Success: ${index.successRuns} | Failure: ${index.failureRuns} | Aborted: ${index.abortedRuns}`,
)
if (index.topFrictions.length > 0) {
  console.log(`   Top friction: "${index.topFrictions[0].title}" (${index.topFrictions[0].count}x)`)
}
```

**Add to package.json**:

```json
"aggregate-auditor": "pnpm tsx scripts/aggregate-auditor.ts"
```

**Validation**: Generates `.tasks/_auditor-index.json`. Handles empty state (0 runs) gracefully.

---

## Step 9: Add `.gitignore` Entry for Run Bundles

**Why**: Run bundles may contain full logs and large diffs. The auditor JSON is small and should be committed, but bundles are ephemeral.

**File to update**: `.gitignore`

**Add**:

```
# Auditor run bundles (ephemeral, only auditor.json is durable)
.tasks/*/runs/*/bundle.json
```

The `auditor.json` files should be committed (they are the durable improvement record). The `bundle.json` files are transient inputs.

---

## Step 10: Update `.opencode/DRIVER.md` Template

**Why**: The Driver template must reference the new AUDIT state so it's available when operators fill in task details.

**File to update**: `.opencode/DRIVER.md`

**Add to the TASK section, after Notes**:

```markdown
Run ID:
<auto-generated or manual>
```

**Update the DRIVER OUTPUT CONTRACT comment**:

```markdown
## DRIVER OUTPUT CONTRACT (MANDATORY)

Output exactly:

Current State:
Blocking Condition:
Next Agent to Run:
Exact Instruction to That Agent:
Run ID: (if in AUDIT or post-AUDIT state)

No commentary. No alternatives. No implementation.
```

---

## Step 11: Add Follow-Up Task Auto-Creation Template

**Why**: When `canClose=false` or on failure runs, the spec requires the orchestrator to create follow-up tasks automatically. Provide a template that can be populated from auditor output.

**File to create**: `scripts/lib/create-follow-up.ts`

```typescript
import fs from 'fs'
import path from 'path'
import type { AuditorOutput } from '../../schemas/auditor-output.schema'

const TASKS_DIR = '.tasks'

/**
 * Create a follow-up task from auditor output.
 * Returns the path to the created task file.
 */
export function createFollowUpTask(auditorOutput: AuditorOutput): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const slug = auditorOutput.chosenImprovement.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '')

  const taskId = `${date}-followup-${slug}`
  const taskDir = path.join(TASKS_DIR, taskId)
  fs.mkdirSync(taskDir, { recursive: true })

  const improvement = auditorOutput.chosenImprovement
  const fa = auditorOutput.failureAnalysis

  const content = `# Follow-Up: ${improvement.title}

## Origin

- Source task: ${auditorOutput.taskId}
- Source run: ${auditorOutput.runId}
- Run state: ${auditorOutput.runState}
- Classification: ${auditorOutput.classification}

## Objective

${improvement.rationale}

## Type

${improvement.type}

## Target Files

${improvement.whereItLives.map((f) => `- ${f}`).join('\n')}

## Acceptance Criteria

${improvement.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}
${
  fa
    ? `
## Failure Context

- Root cause: ${fa.rootCause}
- Missed signal: ${fa.earliestMissedSignal}
- Responsibility: ${fa.responsibilityBoundary}
- Retry safe: ${auditorOutput.retrySafe}
`
    : ''
}
## Notes

${auditorOutput.notes?.join('\n') || '(none)'}
`

  const specPath = path.join(taskDir, 'spec.md')
  fs.writeFileSync(specPath, content.trim(), 'utf-8')

  return taskDir
}
```

**Validation**: Creates a well-formed task directory with spec.md. Title is kebab-cased, date-prefixed.

---

## Step 12: Write Unit Tests

**Why**: Schemas, persistence, validation, and aggregation need automated tests.

**File to create**: `tests/unit/scripts/auditor.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { AuditorOutputSchema } from '../../../schemas/auditor-output.schema'
import { RunBundleSchema } from '../../../schemas/run-bundle.schema'
import { generateRunId } from '../../../scripts/lib/auditor-persistence'

describe('AuditorOutputSchema', () => {
  const validSuccessOutput = {
    runId: 'run-20260210-153000',
    taskId: '20260210-improver',
    runState: 'SUCCESS' as const,
    classification: 'CONTEXT' as const,
    processDelta: ['Build agent spent 3 retries finding the correct file path'],
    chosenImprovement: {
      type: 'INDEX' as const,
      title: 'Add file-path index for exercise conversion pipeline',
      rationale: 'Build agent wasted cycles finding file locations that should be indexed.',
      whereItLives: ['.ai-docs/indexes/pattern-index.json'],
      acceptanceCriteria: [
        'pattern-index.json includes exercise-conversion entries',
        'Build agent can find files in < 1 lookup',
      ],
    },
    canClose: true,
    followUpRequired: false,
    retrySafe: 'YES' as const,
  }

  const validFailureOutput = {
    ...validSuccessOutput,
    runState: 'FAILURE' as const,
    canClose: false,
    followUpRequired: true,
    retrySafe: 'NO' as const,
    classification: 'EXECUTION' as const,
    failureAnalysis: {
      rootCause:
        'Verifier failed because generated types were not regenerated after schema change.',
      earliestMissedSignal:
        'Build agent should run pnpm generate:types after modifying collections.',
      responsibilityBoundary: 'executor' as const,
    },
  }

  it('accepts valid success output', () => {
    expect(AuditorOutputSchema.safeParse(validSuccessOutput).success).toBe(true)
  })

  it('accepts valid failure output', () => {
    expect(AuditorOutputSchema.safeParse(validFailureOutput).success).toBe(true)
  })

  it('rejects empty processDelta', () => {
    const invalid = { ...validSuccessOutput, processDelta: [] }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects more than 4 processDelta bullets', () => {
    const invalid = {
      ...validSuccessOutput,
      processDelta: ['1', '2', '3', '4', '5'],
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects empty whereItLives', () => {
    const invalid = {
      ...validSuccessOutput,
      chosenImprovement: {
        ...validSuccessOutput.chosenImprovement,
        whereItLives: [],
      },
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects fewer than 2 acceptanceCriteria', () => {
    const invalid = {
      ...validSuccessOutput,
      chosenImprovement: {
        ...validSuccessOutput.chosenImprovement,
        acceptanceCriteria: ['only one'],
      },
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects more than 5 acceptanceCriteria', () => {
    const invalid = {
      ...validSuccessOutput,
      chosenImprovement: {
        ...validSuccessOutput.chosenImprovement,
        acceptanceCriteria: ['1', '2', '3', '4', '5', '6'],
      },
    }
    expect(AuditorOutputSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('RunBundleSchema', () => {
  it('accepts valid run bundle', () => {
    const bundle = {
      runId: 'run-20260210-153000',
      taskId: 'test-task',
      taskTitle: 'Test Task',
      taskSpecPath: '.tasks/test-task/spec.md',
      orchestratorTimeline: [
        {
          agent: 'build',
          startedAt: '2026-02-10T15:30:00Z',
          completedAt: '2026-02-10T15:45:00Z',
          state: 'completed' as const,
        },
      ],
      agentOutputs: [
        {
          agentName: 'build',
          state: 'completed' as const,
          summary: 'Built successfully',
        },
      ],
      finalState: 'SUCCESS' as const,
      primaryArtifacts: {
        diffSummary: '3 files changed',
        filesChanged: ['src/a.ts', 'src/b.ts'],
      },
    }
    expect(RunBundleSchema.safeParse(bundle).success).toBe(true)
  })
})

describe('generateRunId', () => {
  it('produces run-YYYYMMDD-HHMMSS format', () => {
    const id = generateRunId()
    expect(id).toMatch(/^run-\d{8}-\d{6}$/)
  })
})

// Filesystem persistence tests would need tmpdir setup
// and mocking of TASKS_DIR constant for full coverage
```

**Validation**: `pnpm test:unit` passes. All schema edge cases covered.

---

## Step 13: Quality Gates

**Commands**:

```bash
pnpm tsc --noEmit
pnpm lint
pnpm format
pnpm test:unit
```

---

## Inventory Summary

### Files to Create (9)

| #   | File                                  | Purpose                                        | Est. Lines |
| --- | ------------------------------------- | ---------------------------------------------- | ---------- |
| 1   | `schemas/auditor-output.schema.ts`    | Auditor output Zod schema                      | ~70        |
| 2   | `schemas/run-bundle.schema.ts`        | Run bundle input Zod schema                    | ~50        |
| 3   | `scripts/lib/auditor-persistence.ts`  | Read/write auditor outputs + run ID generation | ~80        |
| 4   | `.opencode/agents/auditor.md`         | Auditor agent definition (prompt)              | ~120       |
| 5   | `scripts/lib/run-bundle-collector.ts` | Collect run bundle from task artifacts + git   | ~100       |
| 6   | `scripts/validate-auditor.ts`         | CLI validation gate script                     | ~70        |
| 7   | `scripts/aggregate-auditor.ts`        | Cross-task aggregation index builder           | ~100       |
| 8   | `scripts/lib/create-follow-up.ts`     | Auto-create follow-up task from auditor output | ~60        |
| 9   | `tests/unit/scripts/auditor.test.ts`  | Unit tests for schemas, persistence, helpers   | ~120       |

### Files to Modify (4)

| #   | File                    | Change                                                                              | Est. Lines |
| --- | ----------------------- | ----------------------------------------------------------------------------------- | ---------- |
| 1   | `.opencode/PIPELINE.md` | Add STATE 5 (AUDIT), STATE 5b, STATE 4b, update DONE condition, update loop diagram | +40        |
| 2   | `.opencode/DRIVER.md`   | Add Run ID field to template                                                        | +3         |
| 3   | `.gitignore`            | Add bundle.json exclusion                                                           | +2         |
| 4   | `package.json`          | Add `validate-auditor` and `aggregate-auditor` scripts                              | +2         |

---

## Execution Order

| Step | Description                     | Depends On                           | Est. |
| ---- | ------------------------------- | ------------------------------------ | ---- |
| 1    | Define Auditor Output Schema    | --                                   | 20m  |
| 2    | Define Run Bundle Schema        | --                                   | 15m  |
| 3    | Create Persistence Layer        | Step 1                               | 20m  |
| 4    | Create Auditor Agent Definition | Step 1 (for output format reference) | 30m  |
| 5    | Update Pipeline State Machine   | Step 4                               | 30m  |
| 6    | Write Run Bundle Collector      | Step 2                               | 25m  |
| 7    | Create Validation Script        | Steps 1, 3                           | 15m  |
| 8    | Create Aggregation Index Script | Steps 1, 3                           | 20m  |
| 9    | Add .gitignore entry            | --                                   | 2m   |
| 10   | Update DRIVER.md template       | --                                   | 5m   |
| 11   | Create Follow-Up Task Template  | Step 1                               | 15m  |
| 12   | Write Unit Tests                | Steps 1, 2, 3                        | 30m  |
| 13   | Quality Gates                   | All                                  | 15m  |

**Critical path**: 1 → 3 → 7 (schema → persistence → validation)

**Parallelizable**: Steps 1+2, Steps 4+6+9+10, Steps 7+8+11

**Total estimate**: ~4 hours implementation.

---

## Verification Checklist

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test:unit` passes (auditor schema + persistence tests)
- [ ] `pnpm lint` passes
- [ ] `.opencode/PIPELINE.md` has STATE 5 (AUDIT) with correct conditions
- [ ] `.opencode/agents/auditor.md` exists with valid frontmatter
- [ ] `schemas/auditor-output.schema.ts` validates all spec fields
- [ ] `scripts/validate-auditor.ts` exits 0 on valid+canClose, 1 otherwise
- [ ] `scripts/aggregate-auditor.ts` generates `.tasks/_auditor-index.json`
- [ ] Persistence creates `.tasks/<task>/runs/<run>/auditor.json`
- [ ] Follow-up creator generates valid task directory with spec.md
- [ ] No imports to deleted or nonexistent files
- [ ] PIPELINE.md top-down state evaluation is consistent (no dead states, no ambiguous conditions)

---

## Open Questions (for user to decide at implementation time)

1. **Schema package**: Should `schemas/` be a top-level directory (as proposed) or inside `scripts/`? Top-level makes sense since these are contracts used by multiple consumers.

2. **JSON Schema generation**: Should we add a `pnpm generate:auditor-schema` script that runs `zod-to-json-schema` to produce `.json` versions? Useful for non-TS validation but adds a build dependency.

3. **Aggregation trigger**: Should `aggregate-auditor` run automatically after each audit (via the pipeline), or remain manual/on-demand?
