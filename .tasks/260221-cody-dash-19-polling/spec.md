# TASK-19: Adaptive Polling Hook

## Summary
Create a smart polling hook that adjusts refresh interval based on whether tasks are actively building.

## Task Type
implement_feature

## Dependencies
- TASK-08 (kanban board), TASK-13 (task detail)

## Requirements

### R1: useAdaptivePolling hook
- File: `src/ui/admin/CodyDashboard/useAdaptivePolling.ts`
- Client hook

```typescript
interface UseAdaptivePollingOptions {
  tasks: CodyTask[]
  selectedTask: CodyTask | null
  onRefreshBoard: () => Promise<void>
  onRefreshPipeline?: (taskId: string) => Promise<void>
  enabled?: boolean
}

export function useAdaptivePolling(options: UseAdaptivePollingOptions): {
  isPolling: boolean
  interval: number
  lastRefresh: Date | null
}
```

### R2: Interval logic
- **5s**: Selected task is in 'building' column → refresh both board and pipeline
- **10s**: Any task on board is in 'building' column → refresh board only
- **30s**: No tasks building → refresh board only
- When interval changes, reset the timer

### R3: Implementation
- Use `useEffect` with `setInterval`
- Recalculate interval when `tasks` or `selectedTask` changes
- Call `onRefreshBoard()` on each tick
- If selected task is building and `onRefreshPipeline` is provided, also call it
- Cleanup on unmount
- `enabled` prop (default true) to pause polling

### R4: Integration
- Wire into CodyDashboard
- Show polling indicator (small dot or text showing "Refreshing in Xs...")

## Files to Create/Modify
- `src/ui/admin/CodyDashboard/useAdaptivePolling.ts` (NEW)
- `src/ui/admin/CodyDashboard/index.tsx` (MODIFIED — use hook)

## Acceptance Criteria
- [ ] Board refreshes at correct interval based on task states
- [ ] Polling speeds up when tasks are building
- [ ] Polling slows down when idle
- [ ] Cleanup works on unmount (no leaked intervals)
- [ ] `pnpm tsc --noEmit` passes
