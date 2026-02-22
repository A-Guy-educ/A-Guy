# PR-B: Cody Dashboard — UI + Chat + CopilotKit (PARALLEL)

**Branch**: `feat/cody-dash-ui`
**Created**: 2026-02-21
**Status**: Planned
**Parallel with**: PR-A (Backend)
**Consolidates**: TASK-01, TASK-07, TASK-08, TASK-09, TASK-10, TASK-12, TASK-13, TASK-14, TASK-15, TASK-16, TASK-17, TASK-18 (UI only), TASK-19, TASK-20

---

## Summary

Complete frontend for the Cody Operations Dashboard: CopilotKit spike + production runtime, layout/auth, kanban board, pipeline visualization, task detail, chat panel, actions, polling, and polish. This PR is **fully independent** from PR-A — it duplicates types locally and uses real API calls (which 404 gracefully until PR-A merges, or work if PR-A merges first).

---

## Independence Strategy

This PR duplicates types from PR-A in a local file (`src/lib/cody/types.ts`). Both PRs create this file. When PR-C merges, it dedupes. This is intentional to enable parallel work.

**If PR-A merges first**: This PR's types file will conflict — simple resolution: keep PR-A's version (they're identical).

**If PR-B merges first**: PR-A will have the same conflict — same resolution.

**API calls**: All UI components call `/api/cody/*` endpoints. If PR-A hasn't merged yet, these return 404 and the UI shows error states (which we're building anyway in TASK-20). Everything lights up once PR-A lands.

---

## Architecture

```
src/app/(cody)/                    ← Route group
  layout.tsx                       ← HTML layout with Tailwind + CopilotKit CSS
  cody/page.tsx                    ← Auth-gated page
  cody/login/page.tsx              ← Login form
  components/                      ← Local primitives (card, badge)
    card.tsx
    badge.tsx

src/app/api/copilotkit/route.ts    ← CopilotKit runtime

src/lib/cody/                      ← Shared types (duplicated from PR-A)
  types.ts
  constants.ts
  utils.ts
  auth.ts

src/ui/admin/                      ← Dashboard components
  CodyDashboard/
    index.tsx                      ← Main dashboard shell
    CodyActions.tsx                ← CopilotKit action registrations
    CodyContext.tsx                ← CopilotKit readable context
    useAdaptivePolling.ts          ← Smart polling hook
  CodyBoard/
    KanbanBoard.tsx
    KanbanColumn.tsx
    KanbanCard.tsx
    BoardSwitcher.tsx
  CodyShared/
    StatusBadge.tsx
    RiskBadge.tsx
    TaskTypeBadge.tsx
    types.ts
  CodyPipeline/
    PipelineStatus.tsx
    StageIndicator.tsx
    SupervisorLog.tsx
  CodyTasks/
    TaskDetail.tsx
    CreateTaskDialog.tsx
  CodyChat/
    CodyChatPanel.tsx
```

---

## Step 1: CopilotKit Spike (from TASK-01)

### R1: Install CopilotKit packages

- `pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime`
- Do NOT separately install `@copilotkit/runtime-client-gql`
- Verify no critical Zod 3 vs project Zod 4 conflicts

### R2: Create CopilotKit runtime API route

- File: `src/app/api/copilotkit/route.ts`
- First import: `import '@/infra/config/server-init'`
- Logger: `import { logger } from '@/infra/utils/logger/logger'`
- Generate `requestId` per request
- **Adapter strategy** (try in order):
  1. `GoogleGenerativeAIAdapter` with `GEMINI_API_KEY`
  2. Model-string API: `CopilotRuntime({ model: "google/gemini-pro" })`
  3. `OpenAIAdapter` with `OPENAI_API_KEY`
  4. Model-string API: `CopilotRuntime({ model: "openai/gpt-4o" })`
- Use `OPENAI_API_KEY` (not `OPENAI_COMPATIBLE_API_KEY`) — CopilotKit uses native OpenAI SDK
- Env validation: at least one API key must be set
- Error handling: try/catch with logger, dev stack traces

### R3: Create minimal (cody) route group

- File: `src/app/(cody)/layout.tsx` — bare layout with `<html>`, `<body>`, Tailwind
  - Import `'@/app/(frontend)/globals.css'` for Tailwind + design tokens
  - Import `'@copilotkit/react-ui/styles.css'`
- File: `src/app/(cody)/cody/page.tsx` — client component with CopilotKit provider + CopilotChat

### R4: Wire test action + verify streaming

- `useCopilotAction({ name: 'getCurrentTime', handler: async () => new Date().toISOString() })`
- Verify streaming works token-by-token

### R5: Document result

- Write to `.tasks/260221-cody-operations-dashboard/spike-result.md`
- Document: adapter used, issues, versions, Zod conflicts, React 19 compat

### Guardrails

- No new CSS files (husky hook blocks them)
- Use `OPENAI_API_KEY` for CopilotKit, not `OPENAI_COMPATIBLE_API_KEY`
- Zod boundary: document in spike-result.md if issues arise

---

## Step 2: Types & Local Primitives

### R1: Duplicate types locally (from TASK-02)

- File: `src/lib/cody/types.ts` — same types as PR-A
- File: `src/lib/cody/constants.ts` — same constants as PR-A
- File: `src/lib/cody/utils.ts` — `cn()` + `formatDuration()`
- File: `src/lib/cody/auth.ts` — `requireDashboardAuth()` (needed for CopilotKit auth)

**Note**: These files are identical to PR-A. Merge conflict resolution: keep either version.

### R2: Local Card component

- File: `src/app/(cody)/components/card.tsx`
- Simple div with border/shadow/padding

### R3: Local Badge component

- File: `src/app/(cody)/components/badge.tsx`
- Simple span with color variants

---

## Step 3: Layout, Auth & Login (from TASK-07)

### R1: Create (cody) layout

- File: `src/app/(cody)/layout.tsx` (upgrade from spike)
- Server component, own `<html>/<body>` tags
- Import Tailwind + Geist fonts (simplified, no i18n)
- Metadata: `title: 'Cody Dashboard'`

### R2: Auth-gated page

- File: `src/app/(cody)/cody/page.tsx`
- Client component, reads `cody-session` cookie
- No auth -> redirect to `/cody/login`
- Auth OK -> render `<CopilotKit runtimeUrl="/api/copilotkit">` wrapping `<CodyDashboard />`
- Remove spike test code (getCurrentTime action)

### R3: Login page

- File: `src/app/(cody)/cody/login/page.tsx`
- Simple password form
- Submit -> POST `/api/cody/auth` with password
- Success: set cookie, redirect to `/cody`
- Wrong password: show error

### R4: Auth API route

- File: `src/app/api/cody/auth/route.ts`
- Check against `CODY_DASHBOARD_SECRET`, set `cody-session` cookie

---

## Step 4: Badge Components (from TASK-09)

### StatusBadge

- File: `src/ui/admin/CodyShared/StatusBadge.tsx`
- Props: `status: CodyPipelineStatus['state'] | ColumnId`
- Colors: running/building=blue, completed/done=green, failed=red, timeout=orange, gate-waiting=yellow, retrying=amber, open=gray, review=purple

### RiskBadge

- File: `src/ui/admin/CodyShared/RiskBadge.tsx`
- Props: `risk: 'low' | 'medium' | 'high'`
- Colors: low=green, medium=yellow, high=red

### TaskTypeBadge

- File: `src/ui/admin/CodyShared/TaskTypeBadge.tsx`
- Props: `type: string`
- Colors: implement_feature=blue, fix_bug=red, refactor=purple, docs=gray, etc.

### Shared types re-export

- File: `src/ui/admin/CodyShared/types.ts`

---

## Step 5: Kanban Board (from TASK-08)

### KanbanBoard

- File: `src/ui/admin/CodyBoard/KanbanBoard.tsx`
- Client component, horizontal flex layout (`flex gap-4 overflow-x-auto`)
- Receives `tasks: CodyTask[]` and `visibleColumns: ColumnId[]`
- Groups tasks using `organizeBoard()` from board-mapper (local copy or inline logic)

### KanbanColumn

- File: `src/ui/admin/CodyBoard/KanbanColumn.tsx`
- Sticky header with column label + count badge
- Vertical scrollable card list
- Min-width: `min-w-[280px]`

### KanbanCard

- File: `src/ui/admin/CodyBoard/KanbanCard.tsx`
- Shows: title (truncated), taskId, stage progress icons, risk badge, task type badge, preview link, assignee avatars
- Selected state: blue border highlight
- Stage progress: inline `✅✅🔄⏳⏳` from latest running-status comment

### Wire to CodyDashboard

- Update `src/ui/admin/CodyDashboard/index.tsx`
- Fetch from `/api/cody/tasks`, track `selectedTask` state
- Basic loading state

---

## Step 6: Board Switcher (from TASK-10)

### BoardSwitcher

- File: `src/ui/admin/CodyBoard/BoardSwitcher.tsx`
- Fetches boards from `/api/cody/boards`
- Horizontal tab bar, "All" first and default
- Click tab -> `onBoardChange(boardId)` callback

### Wire to CodyDashboard

- `selectedBoard` state (default 'all')
- Pass to tasks API: `/api/cody/tasks?board=${selectedBoard}`
- Re-fetch on board change

---

## Step 7: Pipeline Visualization (from TASK-12)

### PipelineStatus

- File: `src/ui/admin/CodyPipeline/PipelineStatus.tsx`
- Two rows: Spec stages (taskify -> spec -> clarify) and Impl stages (architect -> ... -> pr)
- Autofix as sub-indicator under verify
- Connected by lines between stages
- Null status: show "No pipeline data"

### StageIndicator

- File: `src/ui/admin/CodyPipeline/StageIndicator.tsx`
- Circle with icon + label below
- States: completed (green), running (blue + pulse), failed (red), timeout (orange), pending (gray), skipped (gray dashed), gate-waiting (yellow)
- Elapsed time formatted below label

---

## Step 8: Supervisor Log (from TASK-14)

### SupervisorLog

- File: `src/ui/admin/CodyPipeline/SupervisorLog.tsx`
- Vertical timeline of retry attempts
- Each entry: attempt number, failed stage, root cause, timestamp
- Visual: vertical line, colored dots (blue=retry, red=exhausted)
- Exhausted: red "Max Retries Exhausted" indicator
- No supervisor comments: return null

---

## Step 9: Task Detail Panel (from TASK-13)

### TaskDetail

- File: `src/ui/admin/CodyTasks/TaskDetail.tsx`
- Fetches pipeline from `/api/cody/pipeline/${task.taskId}`
- 12 sections:
  1. Header (title, number, GitHub link, status badge, close button)
  2. Metadata (task type, risk, domain, scope)
  3. Pipeline (PipelineStatus component)
  4. Supervisor (SupervisorLog, if retries exist)
  5. Actions (approve, reject, rerun, abort buttons — visibility based on column)
  6. Latest Error (from failure comment)
  7. Run Link (GitHub Actions URL)
  8. Assignees (with add/remove)
  9. Labels (as badges, with add/remove)
  10. Edit Description (expandable textarea, saves on blur/Cmd+Enter)
  11. Duration (total elapsed for done/failed tasks)
  12. Preview (Vercel deploy link)

### Layout Integration

- Show below kanban board when `selectedTask` is set
- Close button deselects task
- Loading skeleton while pipeline fetches

---

## Step 10: CopilotKit Production Runtime (from TASK-15)

### Upgrade runtime route

- File: `src/app/api/copilotkit/route.ts` (modify from spike)
- Add `requireDashboardAuth(req)` — 401/403 for unauthenticated
- System prompt with full repo context:
  - Stack: Next.js 15, Payload CMS, React 19, TypeScript
  - Pipeline stages (spec + impl, autofix)
  - Task ID format: YYMMDD-slug
  - Risk levels and control modes
  - Supervisor behavior
  - Instruction to use available actions

### Adapter selection

- Based on spike result (Gemini or OpenAI)
- Document choice in comment at top

---

## Step 11: Chat Panel (from TASK-16)

### CodyChatPanel

- File: `src/ui/admin/CodyChat/CodyChatPanel.tsx`
- Uses `<CopilotChat>` from `@copilotkit/react-ui`
- Collapsible right panel or floating button
- Custom labels: "Ask about tasks, pipelines, or take actions..."
- Responsive: side panel on wide, overlay on narrow

### Integration

- Toggle button in dashboard
- Chat persists while navigating between tasks

---

## Step 12: Chat Actions & Context (from TASK-17)

### CodyActions

- File: `src/ui/admin/CodyDashboard/CodyActions.tsx`
- Invisible component inside CopilotKit provider
- **Read actions**: listTasks, getTaskStatus, getWorkflowRuns
- **Write actions**: createTask, approveGate, rerunTask, abortTask, assignTask
- All call `/api/cody/*` endpoints

### CodyContext

- File: `src/ui/admin/CodyDashboard/CodyContext.tsx`
- `useCopilotReadable` for selected task and current board

---

## Step 13: Create Task Dialog + Action Buttons (from TASK-18, UI only)

### CreateTaskDialog

- File: `src/ui/admin/CodyTasks/CreateTaskDialog.tsx`
- Form: title, description, labels, assignees, mode, "Create & Run" checkbox
- Submit -> POST `/api/cody/tasks`
- Success: close dialog, refresh board

### Action Buttons in TaskDetail

- **Approve** (visible when `gate-waiting`)
- **Reject** (visible when `gate-waiting`)
- **Rerun** (visible when `failed` or `retrying`)
- **Abort** (visible when `building`)
- Each calls POST `/api/cody/tasks/[taskId]/actions`
- Loading state on button, refresh after action

### Create Task Button

- "+" button in dashboard header opens CreateTaskDialog

---

## Step 14: Adaptive Polling (from TASK-19)

### useAdaptivePolling hook

- File: `src/ui/admin/CodyDashboard/useAdaptivePolling.ts`
- Interface:

```typescript
interface UseAdaptivePollingOptions {
  tasks: CodyTask[]
  selectedTask: CodyTask | null
  onRefreshBoard: () => Promise<void>
  onRefreshPipeline?: (taskId: string) => Promise<void>
  enabled?: boolean
}
```

- **5s**: Selected task building -> refresh board + pipeline
- **10s**: Any task building -> refresh board
- **30s**: Idle -> refresh board
- `useEffect` + `setInterval`, cleanup on unmount
- Show polling indicator

---

## Step 15: Loading, Empty, Error States + Keyboard Shortcuts (from TASK-20)

### Loading skeletons

- KanbanBoard: 3 skeleton columns with 2-3 skeleton cards
- TaskDetail: skeleton layout while pipeline fetches
- BoardSwitcher: skeleton tabs
- Own skeleton: `animate-pulse bg-gray-200 rounded`

### Empty states

- Empty column: "No tasks" muted text
- Empty board: "No issues found. Create one to get started."
- No pipeline data: "No pipeline data available"
- No boards: only "All" tab

### Error handling

- Toast notifications for API errors (own simple toast or react-hot-toast)
- Rate limit (429): "GitHub API rate limit reached. Retrying in 60s."
- Token expired (502): Banner "GitHub token expired. Check GH_TOKEN."
- Network error toast
- Missing GH_TOKEN: setup instructions instead of board

### Error boundary

- Wrap CodyDashboard, fallback with "Something went wrong" + retry

### Keyboard shortcuts

- `n` — Open CreateTaskDialog
- `a` — Approve gate (detail open + gate-waiting)
- `r` — Rerun (detail open + failed)
- `Escape` — Close detail/dialog
- `?` — Keyboard help overlay
- Only active when no input/textarea focused

---

## Files Summary

### New Files (~28)

- `src/app/api/copilotkit/route.ts`
- `src/app/(cody)/layout.tsx`
- `src/app/(cody)/cody/page.tsx`
- `src/app/(cody)/cody/login/page.tsx`
- `src/app/(cody)/components/card.tsx`
- `src/app/(cody)/components/badge.tsx`
- `src/app/api/cody/auth/route.ts`
- `src/lib/cody/types.ts` (duplicated from PR-A)
- `src/lib/cody/constants.ts` (duplicated from PR-A)
- `src/lib/cody/utils.ts` (duplicated from PR-A)
- `src/lib/cody/auth.ts` (duplicated from PR-A)
- `src/ui/admin/CodyDashboard/index.tsx`
- `src/ui/admin/CodyDashboard/CodyActions.tsx`
- `src/ui/admin/CodyDashboard/CodyContext.tsx`
- `src/ui/admin/CodyDashboard/useAdaptivePolling.ts`
- `src/ui/admin/CodyBoard/KanbanBoard.tsx`
- `src/ui/admin/CodyBoard/KanbanColumn.tsx`
- `src/ui/admin/CodyBoard/KanbanCard.tsx`
- `src/ui/admin/CodyBoard/BoardSwitcher.tsx`
- `src/ui/admin/CodyShared/StatusBadge.tsx`
- `src/ui/admin/CodyShared/RiskBadge.tsx`
- `src/ui/admin/CodyShared/TaskTypeBadge.tsx`
- `src/ui/admin/CodyShared/types.ts`
- `src/ui/admin/CodyPipeline/PipelineStatus.tsx`
- `src/ui/admin/CodyPipeline/StageIndicator.tsx`
- `src/ui/admin/CodyPipeline/SupervisorLog.tsx`
- `src/ui/admin/CodyTasks/TaskDetail.tsx`
- `src/ui/admin/CodyTasks/CreateTaskDialog.tsx`
- `src/ui/admin/CodyChat/CodyChatPanel.tsx`
- `.tasks/260221-cody-operations-dashboard/spike-result.md`

### Modified Files (1)

- `package.json` (add `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`)

---

## Acceptance Criteria

- [ ] `/cody` loads in browser
- [ ] Auth flow works (login, redirect, cookie)
- [ ] CopilotKit spike validates (document adapter in spike-result.md)
- [ ] Kanban board renders with columns (data from API or graceful error states)
- [ ] Board switcher works
- [ ] Clicking card shows task detail panel
- [ ] Pipeline visualization renders correctly
- [ ] Supervisor log timeline renders
- [ ] Chat panel opens, sends/receives messages
- [ ] Chat actions call correct API endpoints
- [ ] Create task dialog works
- [ ] Action buttons show/hide based on task state
- [ ] Adaptive polling adjusts intervals
- [ ] Loading skeletons show during fetches
- [ ] Error states show for API failures
- [ ] Keyboard shortcuts work
- [ ] `pnpm tsc --noEmit` passes
- [ ] Tailwind only, no SCSS

## Guardrails

- No new CSS files (husky hook)
- Use `OPENAI_API_KEY` for CopilotKit, not `OPENAI_COMPATIBLE_API_KEY`
- No Payload dependency
- `cn()` from `@/lib/cody/utils` (own copy)
- No drag-and-drop (V2)
