# Build Agent Report: enhance-failure-reasons

## Changes

- **`src/ui/cody/types.ts`** - Added `failureReason?: string` field to `CodyTask` interface (line 221) to store extracted failure messages for display in the task list.

- **`src/ui/cody/components/TaskList.tsx`** - Enhanced failed task display:
  - Enhanced failed row tint from `'bg-red-500/[0.04]'` to `'bg-red-500/[0.08] ring-1 ring-red-500/30'` for better visual prominence
  - Added failure reason badge after the ERROR badge (lines 369-374) showing an AlertCircle icon and truncated error message (max 32 chars) with full error as tooltip

- **`src/app/api/cody/tasks/route.ts`** - Added failure reason extraction:
  - Added `fetchComments` import from github-client
  - Added Promise.all block after tasks are built to extract failure reasons for failed tasks
  - Searches comments for failure indicators (`❌ Failed`, `pipeline failed`, `Build failed`)
  - Extracts error message by finding lines containing "error:" or falling back to the third line
  - Truncates to 40 characters max

## Tests Written

- No new tests written - this is a UI/API enhancement

## Quality

- TypeScript: PASS (`pnpm tsc --noEmit`)
- Lint: PASS (`pnpm lint`)
