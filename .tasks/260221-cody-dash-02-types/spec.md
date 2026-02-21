# TASK-02: Cody Dashboard Types & Constants

## Summary
Create all shared TypeScript types and constants for the Cody Operations Dashboard. These are the foundation that all other tasks depend on.

## Task Type
implement_feature

## Requirements

### R1: Create types file
- File: `src/lib/cody/types.ts`
- Define all interfaces needed by the dashboard:

```typescript
// Comment types parsed from bot comments
export type CommentType =
  | 'task-marker'
  | 'running-status'
  | 'success'
  | 'failure'        // "Pipeline failed" from catch block
  | 'cody-failed'    // "Cody failed" from formatStatusComment
  | 'timeout'
  | 'gate-hard-stop'
  | 'gate-risk'
  | 'clarify-stop'
  | 'supervisor-retry'
  | 'supervisor-exhausted'
  | 'supervisor-error'
  | 'gate-approval'
  | 'gate-rejection'
  | 'vercel-preview'

// Kanban column identifiers
export type ColumnId = 'open' | 'building' | 'review' | 'done' | 'failed' | 'gate-waiting' | 'retrying'

// Parsed bot comment
export interface ParsedComment {
  type: CommentType
  taskId?: string
  createdAt: string
  body: string
  error?: string
  retryNumber?: number
  maxRetries?: number
  stages?: StageProgress[]
  mode?: string
}

// Stage progress extracted from running status comment
export interface StageProgress {
  name: string
  icon: '✅' | '❌' | '🔄' | '⏳'
  elapsed?: string
}

// Board definition
export interface Board {
  id: string
  name: string
  type: 'label' | 'milestone' | 'all'
}

// Dashboard-level task (enriched GitHub issue)
export interface CodyTask {
  id: string           // issue number as string
  issueNumber: number
  title: string
  body: string
  taskId?: string      // parsed from task marker comment
  column: ColumnId
  labels: string[]
  milestone?: string
  createdAt: string
  updatedAt: string
  comments: ParsedComment[]
  pipelineStatus?: CodyPipelineStatus | null
  associatedPR?: { number: number; url: string; merged: boolean } | null
  workflowRun?: { id: number; status: string; url: string } | null
  latestError?: string
  riskLevel?: 'low' | 'medium' | 'high'
  taskType?: string
  controlMode?: 'auto' | 'risk-gated' | 'hard-stop'
  previewUrl?: string          // Vercel deploy preview URL (from PR comment)
  assignees: string[]          // GitHub usernames assigned to the issue
  totalElapsed?: number        // Total pipeline duration in ms (from status.json)
}

// Column display configuration
export interface ColumnDef {
  id: ColumnId
  label: string
  color: string      // Tailwind color class
  alwaysShow: boolean
}
```

- Re-export `CodyPipelineStatus` and `StageStatus` interfaces (copy from `scripts/cody/cody-utils.ts` lines 38-65 — don't import from scripts, copy the types so dashboard lib doesn't depend on scripts)
- Re-export `TaskDefinition` interface (copy from `scripts/cody/pipeline-utils.ts` lines 49-61)

### R2: Create constants file
- File: `src/lib/cody/constants.ts`

```typescript
export const SPEC_STAGES = ['taskify', 'spec', 'clarify'] as const
export const IMPL_STAGES = ['architect', 'plan-review', 'build', 'commit', 'verify', 'auditor', 'apply-audit', 'pr'] as const
export const AUTOFIX_STAGE = 'autofix' as const
export const ALL_STAGES = [...SPEC_STAGES, ...IMPL_STAGES, AUTOFIX_STAGE] as const

export const COLUMN_DEFS: ColumnDef[] = [
  { id: 'open', label: 'Open', color: 'bg-gray-100', alwaysShow: true },
  { id: 'building', label: 'Building', color: 'bg-blue-100', alwaysShow: true },
  { id: 'gate-waiting', label: 'Gate Waiting', color: 'bg-yellow-100', alwaysShow: false },
  { id: 'retrying', label: 'Retrying', color: 'bg-orange-100', alwaysShow: false },
  { id: 'review', label: 'Review', color: 'bg-purple-100', alwaysShow: false },
  { id: 'failed', label: 'Failed', color: 'bg-red-100', alwaysShow: false },
  { id: 'done', label: 'Done', color: 'bg-green-100', alwaysShow: true },
]

export const POLLING_INTERVALS = {
  idle: 30000,
  board: 10000,
  active: 5000,
} as const

export const BRANCH_PREFIXES = ['feat', 'fix', 'refactor', 'docs', 'chore'] as const
export const TASK_ID_REGEX = /^[0-9]{6}-[a-zA-Z0-9-]+$/
export const WORKFLOW_ID = 'cody.yml'

// Stage output file mapping (mirrors scripts/cody/pipeline-utils.ts STAGE_OUTPUT_MAP)
export const STAGE_OUTPUT_MAP: Record<string, string> = {
  taskify: 'task.json',
  clarify: 'questions.md',
  architect: 'plan.md',
  'plan-review': 'plan-review.md',
  commit: 'commit.md',
  autofix: 'autofix.md',
}
```

## Files to Create
- `src/lib/cody/types.ts` (NEW)
- `src/lib/cody/constants.ts` (NEW)

## Acceptance Criteria
- [ ] `pnpm tsc --noEmit` passes with no errors
- [ ] types.ts exports all listed interfaces and types
- [ ] constants.ts exports all listed constants
- [ ] No imports from `scripts/` directory (types are copied, not imported)

## Notes
- These files have NO dependencies — they can be built first.
- The `CodyPipelineStatus` and `TaskDefinition` types are copied from the scripts to avoid creating a dependency from the dashboard lib to CI scripts.

### R3: Dashboard auth helper (decoupled from Payload)
- File: `src/lib/cody/auth.ts`
- Simple secret-based auth using `CODY_DASHBOARD_SECRET` env var
- Exports:
  - `requireDashboardAuth(req: NextRequest): boolean` — checks cookie `cody-session` or `Authorization: Bearer` header
  - No Payload dependency. No `getPayload()`. No `@payload-config`.

### R4: Own cn() utility
- File: `src/lib/cody/utils.ts`
- Copy of `cn()` (clsx + twMerge) — one function, no import from `@/infra/utils/ui`
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```
- Also add `formatDuration(ms: number): string` helper (e.g., 4232 → "4s", 92000 → "1m 32s")
