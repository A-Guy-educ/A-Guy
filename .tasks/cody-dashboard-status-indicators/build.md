# Build Agent Report: cody-dashboard-status-indicators

## Changes

### Step 1: Cody Assignment Visual Prominence (Enhanced)

- **src/ui/cody/components/TaskList.tsx**: 
  - Bot indicator now shows as a **blue pill/badge** next to issue number: `#507 [🤖 CODY]`
  - The badge has background `bg-blue-500/20` and bold "CODY" text for maximum visibility
  - Removed the separate "Cody" text from meta row
  - Human assignees still show in the meta row via User icon

### Step 2: Substatus Indicators + Timeout Bug Fix

- **src/ui/cody/types.ts**: Added substatus fields to `CodyTask` interface:
  - `gateType?: 'hard-stop' | 'risk-gated'` — gate type when column is 'gate-waiting'
  - `gateStage?: string` — which stage gate paused at ('taskify' | 'architect')
  - `clarifyWaiting?: boolean` — waiting for user to answer questions
  - `isTimeout?: boolean` — pipeline timed out
  - `isExhausted?: boolean` — retries exhausted (terminal failure)
  - `isSupervisorError?: boolean` — infrastructure/supervisor error

- **src/app/api/cody/tasks/route.ts**: Fixed timeout bug — timed-out and cancelled workflow runs now correctly map to 'failed' column (was falling through to 'open'). Added `isTimeout` field from workflow run conclusion.

- **src/app/api/cody/tasks/[taskId]/route.ts**: Added substatus derivation from parsed comments:
  - Gate type from `gate-request` comment body (🚫 Hard Stop vs 🚦 Risk Gate)
  - Gate stage extracted from comment body
  - Clarify-waiting from `clarify-stop` comment type
  - Exhausted/supervisor-error/timeout from respective comment types

- **src/ui/cody/components/TaskList.tsx**: 
  - Gate-waiting now shows **AlertTriangle icon** + **bordered badge** for prominence
  - Gate-waiting shows "🚫 HARD STOP" (red with border) or "🚦 Review" (yellow with border) based on gateType
  - Shows "⚠️ Gate" (yellow with border) when gate type unknown (list view)
  - Failed shows "⏰ Timeout" (orange), "Exhausted" (dark red), or "System Error" (red)
  - Added clarify-waiting indicator "💬 Needs Answer" badge
  - Workflow run indicator now shows orange for `timed_out`, muted for `cancelled`

## Visual Summary

| State | Visual |
|-------|--------|
| Cody assigned | `#507 [🤖 CODY]` (blue pill badge) |
| Gate: Hard Stop | `[⚠️ 🚫 HARD STOP · architect]` (red bordered) |
| Gate: Risk | `[⚠️ 🚦 Review]` (yellow bordered) |
| Gate: Unknown | `[⚠️ ⚠️ Gate]` (yellow bordered) |

## Tests Written

- **tests/unit/ui/cody/task-list-assignment.test.tsx**: 7 tests for bot icon placement

## Quality

- TypeScript: ✅ PASS
- Lint: ✅ PASS
