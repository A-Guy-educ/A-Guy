/**
 * @fileType utility
 * @domain cody
 * @pattern board-mapper
 * @ai-summary Derive kanban columns from issue state + comments + workflow runs
 */
import type { CodyTask, ColumnId, GitHubIssue, ParsedComment, WorkflowRun, GitHubPR } from './types'
import { COLUMN_DEFS } from './constants'

// ============ Column Derivation ============

/**
 * Determine which column a task should appear in based on its state
 */
export function deriveColumn(
  issue: GitHubIssue,
  comments: ParsedComment[],
  workflowRun?: WorkflowRun,
  associatedPR?: GitHubPR | null,
): ColumnId {
  // Sort comments by date (newest last) - Gap #3 fix
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  // Find latest comments of each type (use reverse + find instead of findLast)
  const taskMarker = sorted.find((c: ParsedComment) => c.type === 'task-marker')
  const failure = [...sorted]
    .reverse()
    .find((c: ParsedComment) => c.type === 'failure' || c.type === 'cody-failed')
  const gate = [...sorted].reverse().find((c: ParsedComment) => c.type === 'gate-request')
  const gateApproval = [...sorted].reverse().find((c: ParsedComment) => c.type === 'gate-approval')
  const retries = sorted.filter((c: ParsedComment) => c.type === 'supervisor-retry')
  const exhausted = [...sorted]
    .reverse()
    .find((c: ParsedComment) => c.type === 'supervisor-exhausted')

  // Note: 'done' column removed - we only fetch open issues now
  // Completed tasks are not shown to reduce API polling

  // Failed: failure + max retries exhausted
  if (failure && exhausted) {
    return 'failed'
  }

  // Gate waiting: gate request without subsequent approval
  if (gate && (!gateApproval || gate.createdAt > gateApproval.createdAt)) {
    return 'gate-waiting'
  }

  // Retrying: has retries, not exhausted
  if (retries.length > 0 && !exhausted && failure) {
    return 'retrying'
  }

  // Building: has task marker and workflow is active
  if (taskMarker && workflowRun?.status === 'in_progress') {
    return 'building'
  }

  // Review: has associated PR (not merged)
  if (associatedPR && !associatedPR.merged_at) {
    return 'review'
  }

  // Building: has task marker (may be between retries or queued)
  if (taskMarker) {
    return 'building'
  }

  // No task marker → open
  return 'open'
}

// ============ Board Organization ============

/**
 * Organize tasks into columns
 */
export function organizeBoard(tasks: CodyTask[]): Record<ColumnId, CodyTask[]> {
  const columns: Record<ColumnId, CodyTask[]> = {
    open: [],
    building: [],
    review: [],
    failed: [],
    'gate-waiting': [],
    retrying: [],
  }

  for (const task of tasks) {
    const column = task.column
    if (columns[column]) {
      columns[column].push(task)
    }
  }

  // Sort each column by updatedAt (newest first)
  for (const columnId of Object.keys(columns)) {
    columns[columnId as ColumnId].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }

  return columns
}

/**
 * Get visible columns (columns that have tasks, plus always-visible ones)
 */
export function getVisibleColumns(tasks: CodyTask[]): ColumnId[] {
  const alwaysVisible: ColumnId[] = ['open', 'building']
  const columnCounts = new Map<ColumnId, number>()

  // Count tasks per column
  for (const task of tasks) {
    const count = columnCounts.get(task.column) || 0
    columnCounts.set(task.column, count + 1)
  }

  // Get columns with tasks
  const columnsWithTasks = Array.from(columnCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([columnId]) => columnId)

  // Combine always visible + columns with tasks, sorted by order
  const allColumns = new Set([...alwaysVisible, ...columnsWithTasks])

  return Array.from(allColumns).sort((a, b) => {
    return (COLUMN_DEFS[a]?.order ?? 0) - (COLUMN_DEFS[b]?.order ?? 0)
  })
}

// ============ Task Building ============

/**
 * Build a CodyTask from raw GitHub data
 */
export function buildCodyTask(options: {
  issue: GitHubIssue
  comments: ParsedComment[]
  workflowRun?: WorkflowRun
  associatedPR?: GitHubPR | null
}): CodyTask {
  const { issue, comments, workflowRun, associatedPR } = options

  // Find task ID from comments
  const taskMarker = comments.find((c) => c.type === 'task-marker')
  const taskId = taskMarker?.taskId || `issue-${issue.number}`

  // Derive column
  const column = deriveColumn(issue, comments, workflowRun, associatedPR)

  return {
    id: taskId,
    issueNumber: issue.number,
    title: issue.title,
    body: issue.body || '',
    state: issue.state,
    labels: issue.labels.map((l) => l.name),
    column,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    workflowRun,
    associatedPR,
  }
}
