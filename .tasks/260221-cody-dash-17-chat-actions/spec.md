# TASK-17: Chat Actions & Context

## Summary
Wire CopilotKit actions (useCopilotAction) and readable context (useCopilotReadable) so the chat assistant can query and act on real data.

## Task Type
implement_feature

## Dependencies
- TASK-16 (chat panel), TASK-06 (tasks API), TASK-11 (pipeline API)

## Requirements

### R1: CodyActions component
- File: `src/ui/admin/CodyDashboard/CodyActions.tsx`
- Client component that registers all CopilotKit actions
- Render as invisible component inside CopilotKit provider

**Read actions** (useCopilotAction):
```typescript
// List all tasks with optional board filter
useCopilotAction({
  name: 'listTasks',
  description: 'List tasks on the kanban board',
  parameters: [{ name: 'board', type: 'string', description: 'Board name (default: all)', required: false }],
  handler: async ({ board }) => {
    const res = await fetch(`/api/cody/tasks?board=${board || 'all'}`)
    return res.json()
  }
})

// Get pipeline status for a specific task
useCopilotAction({
  name: 'getTaskStatus',
  description: 'Get detailed pipeline status for a task',
  parameters: [{ name: 'taskId', type: 'string', required: true }],
  handler: async ({ taskId }) => {
    const res = await fetch(`/api/cody/pipeline/${taskId}`)
    return res.json()
  }
})

// Get active workflow runs
useCopilotAction({
  name: 'getWorkflowRuns',
  description: 'Get active Cody workflow runs',
  handler: async () => {
    const res = await fetch('/api/cody/workflows')
    return res.json()
  }
})
```

**Write actions** (wired to action API, implemented in TASK-18):
```typescript
// Create a new task (creates GitHub issue + optionally triggers Cody)
useCopilotAction({
  name: 'createTask',
  description: 'Create a new task (GitHub issue) and optionally trigger Cody',
  parameters: [
    { name: 'title', type: 'string', required: true },
    { name: 'body', type: 'string', required: true },
    { name: 'triggerWorkflow', type: 'boolean', required: false },
  ],
  handler: async ({ title, body, triggerWorkflow }) => {
    const res = await fetch('/api/cody/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, triggerWorkflow }),
    })
    return res.json()
  }
})

// Approve a gate
useCopilotAction({
  name: 'approveGate',
  description: 'Approve a pending gate for a task',
  parameters: [{ name: 'taskId', type: 'string', required: true }],
  handler: async ({ taskId }) => {
    const res = await fetch(`/api/cody/tasks/${taskId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    return res.json()
  }
})

// Rerun a task from a specific stage
useCopilotAction({
  name: 'rerunTask',
  description: 'Rerun a failed task, optionally from a specific stage',
  parameters: [
    { name: 'taskId', type: 'string', required: true },
    { name: 'fromStage', type: 'string', required: false },
    { name: 'feedback', type: 'string', required: false },
  ],
  handler: async ({ taskId, fromStage, feedback }) => {
    const res = await fetch(`/api/cody/tasks/${taskId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rerun', fromStage, feedback }),
    })
    return res.json()
  }
})

// Abort a running task
useCopilotAction({
  name: 'abortTask',
  description: 'Cancel a running workflow for a task',
  parameters: [{ name: 'taskId', type: 'string', required: true }],
  handler: async ({ taskId }) => {
    const res = await fetch(`/api/cody/tasks/${taskId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'abort' }),
    })
    return res.json()
  }
})
```

### R2: CodyContext component
- File: `src/ui/admin/CodyDashboard/CodyContext.tsx`
- Client component
- Uses `useCopilotReadable` to provide context:

```typescript
// Selected task context
useCopilotReadable({
  description: 'Currently selected task on the dashboard',
  value: selectedTask ? {
    taskId: selectedTask.taskId,
    title: selectedTask.title,
    column: selectedTask.column,
    riskLevel: selectedTask.riskLevel,
    latestError: selectedTask.latestError,
  } : null,
})

// Current board
useCopilotReadable({
  description: 'Current board being viewed',
  value: currentBoard,
})
```

### R3: Integration
- CodyActions and CodyContext rendered inside CopilotKit provider in CodyDashboard
- Pass selectedTask and currentBoard as props

## Files to Create/Modify
- `src/ui/admin/CodyDashboard/CodyActions.tsx` (NEW)
- `src/ui/admin/CodyDashboard/CodyContext.tsx` (NEW)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED — render CodyActions + CodyContext)

## Acceptance Criteria
- [ ] Chat can answer "what tasks are building?" (calls listTasks action)
- [ ] Chat can answer "what's the status of task 260219-auto-98?" (calls getTaskStatus)
- [ ] Chat knows which task is selected (via readable context)
- [ ] Write actions call correct API endpoints
- [ ] `pnpm tsc --noEmit` passes

### R1b: Assign task action

```typescript
// Assign a user to a task
useCopilotAction({
  name: 'assignTask',
  description: 'Assign a GitHub user to a task',
  parameters: [
    { name: 'taskId', type: 'string', required: true },
    { name: 'username', type: 'string', required: true },
  ],
  handler: async ({ taskId, username }) => {
    const res = await fetch(`/api/cody/tasks/${taskId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', assignees: [username] }),
    })
    return res.json()
  }
})
```
