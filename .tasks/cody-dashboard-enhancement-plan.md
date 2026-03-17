# Cody Dashboard Enhancement — Detailed Implementation Plan

## Overview

**9 features** across **~18 files modified** and **~5 new files**. Each feature below specifies exact files, line numbers, and code changes.

---

## Feature 1: Sort Controls

### Goal
Add a Sort dropdown + asc/desc toggle button to `FilterBar` with 9 sort fields.

### Files & Changes

#### 1.1 `src/ui/cody/types.ts` — Add sort types (after line 241)

```typescript
// After CodyTask interface (line 241)
export type SortField =
  | 'updatedAt'
  | 'createdAt'
  | 'issueNumber'
  | 'column'
  | 'riskLevel'
  | 'pipelineProgress'
  | 'assignee'
  | 'title'
  | 'label'

export type SortDirection = 'asc' | 'desc'
```

#### 1.2 `src/ui/cody/utils.ts` — Add `sortTasks()` function (after line 90)

New function `sortTasks(tasks, field, direction)` with comparator logic:

| Field | Comparator |
|---|---|
| `updatedAt` / `createdAt` | `Date` comparison |
| `issueNumber` | Numeric |
| `column` | Uses `COLUMN_DEFS[col].order` from `constants.ts` |
| `riskLevel` | Map: `high=0, medium=1, low=2, undefined=3` |
| `pipelineProgress` | Count completed stages in `task.pipeline?.stages` |
| `assignee` | First assignee login alphabetically, unassigned sorts last |
| `title` | `localeCompare` |
| `label` | First label alphabetically, unlabeled sorts last |

Import `COLUMN_DEFS` from `../constants`. Returns a new sorted array (immutable).

#### 1.3 `src/ui/cody/components/FilterBar.tsx` — Add sort controls

**Add to imports** (line 17): `ArrowUpDown, ArrowUp, ArrowDown` from `lucide-react`

**Add constant** (after line 37):
```typescript
const SORT_OPTIONS = [
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Created', value: 'createdAt' },
  { label: 'Issue #', value: 'issueNumber' },
  { label: 'Status', value: 'column' },
  { label: 'Risk', value: 'riskLevel' },
  { label: 'Progress', value: 'pipelineProgress' },
  { label: 'Assignee', value: 'assignee' },
  { label: 'Title', value: 'title' },
  { label: 'Label', value: 'label' },
] as const
```

**Add to `FilterBarProps`** (after line 56):
```typescript
sortField: SortField
onSortFieldChange: (field: SortField) => void
sortDirection: SortDirection
onSortDirectionChange: (direction: SortDirection) => void
```

**Add to JSX** — Insert between the Label filter `</Select>` (line 187) and the task count `<span>` (line 190):

```tsx
{/* Sort control */}
<Select value={sortField} onValueChange={onSortFieldChange}>
  <SelectTrigger className="w-full md:w-32">
    <SelectValue placeholder="Sort by" />
  </SelectTrigger>
  <SelectContent>
    {SORT_OPTIONS.map((s) => (
      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
<button
  type="button"
  onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
  className="h-8 w-8 rounded-md border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
  title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
>
  {sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
</button>
```

**Export**: `SORT_OPTIONS`

#### 1.4 `src/ui/cody/components/CodyDashboard.tsx` — Wire sort state

**Add state** (after `debouncedSearch` state, ~line 96):
```typescript
const [sortField, setSortField] = useState<SortField>(() => {
  if (typeof window === 'undefined') return 'updatedAt'
  return (new URLSearchParams(window.location.search).get('sort') as SortField) ?? 'updatedAt'
})
const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
  if (typeof window === 'undefined') return 'desc'
  return (new URLSearchParams(window.location.search).get('dir') as SortDirection) ?? 'desc'
})
```

**Add to URL persistence** (line 294-310 `useEffect`): Persist `sort` and `dir` params.

**Apply sorting** (line 358-364): After `filteredTasks` useMemo, wrap result:
```typescript
const sortedTasks = useMemo(
  () => sortTasks(filteredTasks, sortField, sortDirection),
  [filteredTasks, sortField, sortDirection],
)
```

Replace `filteredTasks` with `sortedTasks` in the `<TaskList>` prop (line ~803).

**Pass props to FilterBar** (lines 736-756): Add `sortField`, `onSortFieldChange`, `sortDirection`, `onSortDirectionChange`.

---

## Feature 2: Backlog Issue Edit Dialog

### Goal
Full edit dialog for existing GitHub issues — title, markdown body, labels, assignees.

### Files & Changes

#### 2.1 `src/app/api/cody/tasks/[taskId]/actions/route.ts` — Add `'update'` action

**Expand `actionSchema`** (line 30-57):
- Add `'update'` to the `z.enum` array (line 48, after `'approve-pr'`)
- Add `title: z.string().optional()` and `body: z.string().optional()` to schema fields

**Add switch case** (before `default:` at line 338):
```typescript
case 'update': {
  const updates: { title?: string; body?: string; labels?: string[]; assignees?: string[] } = {}
  if (body.title) updates.title = body.title
  if (body.body !== undefined) updates.body = body.body
  if (body.assignees) updates.assignees = body.assignees
  if (body.label) updates.labels = body.label.split(',') // or handle as array

  await updateIssue(issueNumber, updates)
  if (actor) await postComment(issueNumber, `📝 Issue updated _(by @${actor})_`)
  clearCache()
  return NextResponse.json({ success: true, message: 'Issue updated' })
}
```

**Note**: The `updateIssue` function in `github-client.ts:1314` already accepts `{ title?, body?, state?, labels?, assignees? }` — no changes needed there.

**Schema adjustment**: The current schema uses `label: z.string().optional()` (singular). For the update action, we need to pass `labels` as an array. Two options:
- Option A: Add `labels: z.array(z.string()).optional()` alongside existing `label` field
- Option B: Reuse `assignees` field pattern (already an array) and add `labels` array field

I recommend **Option A** — add `labels: z.array(z.string()).optional()` to the schema. The update case uses this array directly.

#### 2.2 `src/ui/cody/api.ts` — Add `tasksApi.update()` method

Add after `create` method (~line 123):
```typescript
update: async (
  issueNumber: number,
  data: {
    title?: string
    body?: string
    labels?: string[]
    assignees?: string[]
    actorLogin?: string
  },
): Promise<ActionResponse> => {
  const res = await fetch(`${API_BASE}/tasks/issue-${issueNumber}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update',
      title: data.title,
      body: data.body,
      labels: data.labels,
      assignees: data.assignees,
      ...(data.actorLogin && { actorLogin: data.actorLogin }),
    }),
  })
  return handleResponse(res)
},
```

#### 2.3 `src/ui/cody/components/EditTaskDialog.tsx` — **New file** (~350 lines)

Based on `CreateTaskDialog.tsx` patterns:
- Reuse the same markdown toolbar (Bold, Italic, Code, Heading, etc.)
- Reuse the `insertMarkdown()` helper
- Reuse the preview toggle (edit/preview with `ReactMarkdown`)
- Reuse the label picker and assignee picker patterns

**Props interface**:
```typescript
interface EditTaskDialogProps {
  open: boolean
  onClose: () => void
  task: CodyTask | null
  boards: Board[]
  collaborators: GitHubCollaborator[]
  onSaved?: () => void
}
```

**State**: `title`, `body`, `labels`, `assignees`, `showPreview`, `isSaving`

**On open** (`useEffect` on `task`): Pre-fill all state from `task` props.

**On save**: Call `tasksApi.update(task.issueNumber, { title, body, labels, assignees, actorLogin })`, invalidate query cache, call `onSaved`, close dialog.

**UI layout**: Same as `CreateTaskDialog` — `Dialog` > `DialogContent` (max-w-800px) > `DialogHeader` > Title input > Markdown toolbar > Editor/Preview > Labels + Assignees > Footer (Cancel + Save).

**Key difference from CreateTaskDialog**: No "mode" selector, no attachments (GitHub API doesn't support editing attachments), pre-filled state.

#### 2.4 `src/ui/cody/components/TaskList.tsx` — Add edit button to rows

**Add to imports**: `Pencil` from `lucide-react`

**Add to `TaskListProps`** (line 43-58): `onEditTask?: (task: CodyTask) => void`

**Add edit button** in the actions column (line ~385, alongside the play/stop/preview buttons):
```tsx
{onEditTask && (
  <button
    onClick={(e) => { e.stopPropagation(); onEditTask(task) }}
    className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
    title="Edit task"
  >
    <Pencil className="w-3.5 h-3.5" />
  </button>
)}
```

#### 2.5 `src/ui/cody/components/TaskDetail.tsx` — Add edit button to header

**Add to `TaskDetailProps`** (line 58): `onEditTask?: (task: CodyTask) => void`

**Add to imports**: `Pencil` from `lucide-react`

**Add Edit button** in desktop header (line ~1182, before OverflowMenu):
```tsx
{onEditTask && (
  <SimpleTooltip content="Edit task" side="bottom">
    <Button
      variant="outline"
      size="sm"
      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-muted-foreground"
      onClick={() => onEditTask(task)}
    >
      <Pencil className="w-3 h-3" />
    </Button>
  </SimpleTooltip>
)}
```

Same for mobile bottom toolbar.

#### 2.6 `src/ui/cody/components/CodyDashboard.tsx` — Wire EditTaskDialog

**Add state**: `const [editingTask, setEditingTask] = useState<CodyTask | null>(null)`

**Add handler**:
```typescript
const handleEditTask = useCallback((task: CodyTask) => {
  setEditingTask(task)
}, [])
```

**Pass to TaskList**: `onEditTask={handleEditTask}`

**Pass to TaskDetail**: `onEditTask={handleEditTask}`

**Add dialog to render** (after BugReportDialog, line ~974):
```tsx
<EditTaskDialog
  open={!!editingTask}
  onClose={() => setEditingTask(null)}
  task={editingTask}
  boards={boards}
  collaborators={collaborators}
  onSaved={() => { refetch(); setEditingTask(null) }}
/>
```

**Fetch boards and collaborators**: These are already available via `codyApi.boards.list()` and `codyApi.collaborators.list()`. Add two `useQuery` calls for them (they're cached, rarely change).

#### 2.7 `src/ui/cody/hooks/index.ts` — Add `useUpdateTask` mutation

Add a new `update` mutation to `useTaskActions` (after `unassign` mutation, line ~360):
```typescript
const update = useMutation({
  mutationFn: (data: { title?: string; body?: string; labels?: string[]; assignees?: string[] }) =>
    codyApi.tasks.update(issueNumber, { ...data, actorLogin }),
  onSuccess: handleSuccess('Task updated'),
  onError: handleError('update task'),
})
```

Add to `isPending` check and return object.

---

## Feature 3: Remove Split View Button

### Goal
Remove the "Split View" popup window button from PreviewActions.

### Files & Changes

#### 3.1 `src/ui/cody/components/PreviewActions.tsx`

**Remove from imports** (line 22): Remove `SquareSplitHorizontal` from lucide-react imports

**Remove handler** (lines 113-132): Delete `handleSplitView` function entirely

**Remove JSX** (lines 171-182): Delete the Split View button block:
```tsx
{/* Split View */}
{task.previewUrl && (
  <Button ... onClick={handleSplitView} ...>
    <SquareSplitHorizontal ... />
    <span ...>Split View</span>
  </Button>
)}
```

---

## Feature 4: Move Approve UI / Approve PR / Merge to Preview Only

### Goal
Remove these 3 buttons from TaskDetail. They remain only in PreviewActions (inside PreviewModal).

### Files & Changes

#### 4.1 `src/ui/cody/components/TaskDetail.tsx`

**Desktop header** — Remove 3 button blocks (lines 1118-1156):

| Lines | What to remove |
|---|---|
| 1118-1128 | MergeButton block (review column check + `<MergeButton>`) |
| 1130-1142 | Approve UI button block |
| 1144-1156 | Approve PR button block |

After removal, the desktop header actions area (line 1117 `<div>`) will contain:
1. Primary action (Run/Retry/Approve Gate) — stays
2. OverflowMenu — stays
3. **Edit button** — new (from Feature 2)
4. Separator — stays
5. Refresh — stays
6. Close (X) — stays

**Mobile bottom toolbar** — Remove 3 button blocks (lines 1464-1502):

| Lines | What to remove |
|---|---|
| 1464-1474 | MergeButton block |
| 1476-1488 | Approve UI button |
| 1490-1502 | Approve PR button |

After removal, mobile toolbar will have: Primary action → Quick link pills → Spacer → OverflowMenu.

**Remove unused imports** from TaskDetail:
- `MergeButton` import (line ~39 area) — if no longer used
- `CheckCircle` icon — if only used by Approve UI button

**Remove unused props**: `onApproveReview` and `isMerging` from `TaskDetailProps` (lines 59-60) — they were only used for MergeButton. Also remove from the CodyDashboard call site.

**Keep**: The Preview quick-link pill (line ~967 area) stays so users can navigate to PreviewModal for these actions. Consider adding a tooltip hint like "Approve & merge from Preview".

#### 4.2 `src/ui/cody/components/CodyDashboard.tsx`

Remove the `onApproveReview` and `isMerging` props from the `<TaskDetail>` component call. The merge mutation still exists in CodyDashboard for use by `PreviewModal`.

---

## Feature 5: Keyboard Shortcuts

### Goal
Vim-style navigation + common action shortcuts with help dialog.

### Files & Changes

#### 5.1 `src/ui/cody/hooks/useKeyboardShortcuts.ts` — **New file** (~120 lines)

```typescript
interface ShortcutActions {
  onNavigateDown: () => void     // j
  onNavigateUp: () => void       // k
  onOpenSelected: () => void     // Enter
  onCloseDetail: () => void      // Escape
  onRefresh: () => void          // r
  onNewTask: () => void          // n
  onEdit: () => void             // e
  onOpenPreview: () => void      // p
  onFocusSearch: () => void      // /
  onShowHelp: () => void         // ?
}
```

Implementation:
- Single `useEffect` with `keydown` listener on `document`
- **Guard**: Skip if `event.target` is `input`, `textarea`, `select`, or `[contenteditable]`
- **Guard**: Skip if any modifier key is pressed (Ctrl/Cmd/Alt) to avoid conflicts
- Map key to action callback
- Return cleanup function

#### 5.2 `src/ui/cody/components/KeyboardShortcutsDialog.tsx` — **New file** (~100 lines)

Simple dialog showing a table of shortcuts:

| Key | Action |
|---|---|
| `j` / `k` | Navigate down / up |
| `Enter` | Open selected task |
| `Esc` | Close detail / dialog |
| `r` | Refresh |
| `n` | New task |
| `e` | Edit selected task |
| `p` | Preview (if PR exists) |
| `/` | Focus search |
| `?` | Show this help |

Uses `Dialog` from shadcn/ui.

#### 5.3 `src/ui/cody/components/CodyDashboard.tsx` — Wire shortcuts

**Add state**: `const [focusedIndex, setFocusedIndex] = useState<number>(0)`

**Add state**: `const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)`

**Add `searchInputRef`**: `const searchInputRef = useRef<HTMLInputElement>(null)`

**Call hook**:
```typescript
useKeyboardShortcuts({
  onNavigateDown: () => setFocusedIndex(i => Math.min(i + 1, sortedTasks.length - 1)),
  onNavigateUp: () => setFocusedIndex(i => Math.max(i - 1, 0)),
  onOpenSelected: () => { if (sortedTasks[focusedIndex]) handleTaskClick(sortedTasks[focusedIndex]) },
  onCloseDetail: () => { if (selectedTask) handleCloseDetail(); else if (showPreview) setShowPreview(false) },
  onRefresh: () => refetch(),
  onNewTask: () => setShowCreateDialog(true),
  onEdit: () => { if (selectedTask) handleEditTask(selectedTask) },
  onOpenPreview: () => { if (selectedTask?.associatedPR) setShowPreview(true) },
  onFocusSearch: () => searchInputRef.current?.focus(),
  onShowHelp: () => setShowShortcutsHelp(true),
})
```

**Reset `focusedIndex`** when `sortedTasks` changes (or when filters change).

#### 5.4 `src/ui/cody/components/TaskList.tsx` — Highlight focused row

**Add to `TaskListProps`**: `focusedIndex?: number`

**Add visual highlight**: On the task row div (line ~188), add conditional class:
```typescript
className={cn(
  // existing classes...
  index === focusedIndex && 'ring-1 ring-blue-500/40 bg-blue-500/5',
)}
```

**Scroll into view**: `useEffect` to scroll focused row into view when `focusedIndex` changes.

#### 5.5 `src/ui/cody/components/FilterBar.tsx` — Accept search ref

**Add to `FilterBarProps`**: `searchInputRef?: React.RefObject<HTMLInputElement>`

Pass ref to the search `<input>` element (line 136).

---

## Feature 6: Quick Task Duplication

### Goal
Duplicate an existing task into CreateTaskDialog with pre-filled data.

### Files & Changes

#### 6.1 `src/ui/cody/components/CreateTaskDialog.tsx` — Accept `initialData` prop

**Add to props** (~line 58):
```typescript
initialData?: {
  title: string
  body: string
  labels?: string[]
  assignees?: string[]
}
```

**Modify reset `useEffect`** (line 86-97): When dialog opens, if `initialData` is present, pre-fill title (prefixed "Copy of "), body, labels, assignees from it instead of clearing to empty.

#### 6.2 `src/ui/cody/components/TaskDetail.tsx` — Add "Duplicate" to overflow menu

In `getOverflowActions()` (line 275-364), add a new action:
```typescript
{ id: 'duplicate', label: 'Duplicate Task', icon: Copy, onClick: () => onDuplicate?.(task) }
```

Add `onDuplicate?: (task: CodyTask) => void` to `TaskDetailProps`.

#### 6.3 `src/ui/cody/components/TaskList.tsx` — Add duplicate to row actions

Add a copy icon button alongside the edit button (from Feature 2).

#### 6.4 `src/ui/cody/components/CodyDashboard.tsx` — Wire duplication

```typescript
const [duplicateSource, setDuplicateSource] = useState<CodyTask | null>(null)
```

When `duplicateSource` is set, open `CreateTaskDialog` with `initialData` derived from the source task.

---

## Feature 7: Dark/Light Mode Toggle

### Goal
Add a theme toggle — currently dark-only.

### Files & Changes

#### 7.1 `src/ui/cody/hooks/useTheme.ts` — **New file** (~50 lines)

```typescript
type Theme = 'dark' | 'light' | 'system'

export function useCodyTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('cody-theme') as Theme) ?? 'dark'
  })

  useEffect(() => {
    localStorage.setItem('cody-theme', theme)
    const root = document.documentElement
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', isDark)
    root.classList.toggle('light', !isDark)
  }, [theme])

  return { theme, setTheme }
}
```

#### 7.2 `src/ui/cody/components/CodyDashboard.tsx` — Add toggle button

Add `Sun` / `Moon` icon toggle in the header (alongside refresh button, ~line 701).

#### 7.3 Component audit — Add `dark:` variants

Files with hardcoded dark colors that need light-mode alternatives:

| File | Example change |
|---|---|
| `FilterBar.tsx` | `bg-white/[0.04]` → `bg-zinc-100 dark:bg-white/[0.04]` |
| `TaskList.tsx` | `bg-zinc-950/50` → `bg-white dark:bg-zinc-950/50` |
| `TaskDetail.tsx` | `bg-black/20` → `bg-zinc-50 dark:bg-black/20` |
| `PreviewActions.tsx` | `bg-zinc-950/80` → `bg-white dark:bg-zinc-950/80` |
| `CodyDashboard.tsx` | `bg-background` already uses semantic tokens (good) |
| `CreateTaskDialog.tsx` | Various `border-white/[0.08]` → `border-zinc-200 dark:border-white/[0.08]` |

**Scope note**: This is the highest-surface-area feature. Most changes are small (add `dark:` prefix to existing classes, add light-mode equivalents). I estimate ~15-20 files need updates with ~2-5 class changes each.

---

## Feature 8: Task Priority Field

### Goal
Priority levels (P0-P3) derived from GitHub labels, with visual indicators.

### Files & Changes

#### 8.1 `src/ui/cody/types.ts` — Add priority type

```typescript
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3' | null
```

Add `priority?: TaskPriority` to `CodyTask` interface (line ~241).

#### 8.2 `src/app/api/cody/tasks/route.ts` — Derive priority from labels

In the issue-to-task mapping, parse labels for `priority:P0` through `priority:P3`:
```typescript
const priorityLabel = issue.labels.find(l => l.name.startsWith('priority:'))
const priority = priorityLabel ? priorityLabel.name.split(':')[1] as TaskPriority : null
```

#### 8.3 `src/ui/cody/components/TaskList.tsx` — Show priority badge

Add a small colored dot/pill next to the title:

| Priority | Color | Label |
|---|---|---|
| P0 | Red | Critical |
| P1 | Orange | High |
| P2 | Yellow | Medium |
| P3 | Gray | Low |

#### 8.4 `src/ui/cody/components/EditTaskDialog.tsx` — Priority selector

Add a `Select` for priority (P0-P3) that maps to adding/removing `priority:PX` labels.

#### 8.5 `src/ui/cody/utils.ts` — Add priority to sortTasks

Add `priority` as a sort field. Comparator: P0 > P1 > P2 > P3 > null.

---

## Feature 9: Branch Cleanup Tool

### Goal
Show orphaned branches (no matching open issue/PR) with bulk delete.

### Files & Changes

#### 9.1 `src/app/api/cody/branches/route.ts` — **New file** (~120 lines)

**GET handler**:
- Fetch all branches matching `feat/*`, `fix/*`, `refactor/*` etc. via `octokit.repos.listBranches`
- Fetch all open PRs and open issues in parallel
- Cross-reference: a branch is "orphaned" if no open PR references it AND no open issue matches its number pattern
- Return: `{ branches: Array<{ name, lastCommitDate, lastCommitAuthor, issueNumber? }> }`

**DELETE handler**:
- Accept `{ branches: string[] }` body
- Validate: refuse to delete `main`, `master`, `dev`
- Call `deleteBranch(name)` for each
- Return: `{ deleted: string[], failed: string[] }`

#### 9.2 `src/ui/cody/api.ts` — Add `branchesApi`

```typescript
export const branchesApi = {
  listOrphaned: async (): Promise<{ branches: OrphanedBranch[] }> => { ... },
  deleteMany: async (branches: string[]): Promise<{ deleted: string[]; failed: string[] }> => { ... },
}
```

#### 9.3 `src/ui/cody/components/BranchCleanupDialog.tsx` — **New file** (~200 lines)

Dialog with:
- Table: Branch name, age (relative time), last commit author, matched issue #
- Select all checkbox + individual checkboxes
- "Delete Selected" button with count badge
- Confirmation dialog before deletion
- Loading state while fetching branches
- Success toast with count of deleted branches

#### 9.4 `src/ui/cody/components/CodyDashboard.tsx` — Add trigger

Add "Cleanup Branches" button to the header overflow area or alongside "Report Bug":
```tsx
<Button variant="outline" size="sm" onClick={() => setShowBranchCleanup(true)}>
  <GitBranch className="w-4 h-4 mr-1.5" />
  Cleanup
</Button>
```

---

## Implementation Order & Dependencies

```
Phase 1 — Quick wins (no dependencies):
  3. Remove Split View          (~5 min, 1 file)
  4. Move Buttons to Preview    (~20 min, 2 files)

Phase 2 — Core features:
  1. Sort Controls              (~45 min, 4 files)
  2. Backlog Edit Dialog        (~90 min, 7 files, 1 new)

Phase 3 — Enhancement features:
  5. Keyboard Shortcuts         (~60 min, 4 files, 2 new)
  6. Quick Task Duplication     (~30 min, 4 files)

Phase 4 — Polish & new capability:
  8. Task Priority              (~45 min, 5 files)
  7. Dark/Light Mode            (~90 min, ~18 files)
  9. Branch Cleanup            (~60 min, 3 files, 2 new)
```

### File Impact Summary

| File | Features touching it |
|---|---|
| `types.ts` | 1, 8 |
| `utils.ts` | 1, 8 |
| `api.ts` | 2, 9 |
| `FilterBar.tsx` | 1, 5, 7 |
| `CodyDashboard.tsx` | 1, 2, 4, 5, 6, 7, 9 |
| `TaskList.tsx` | 2, 5, 6, 7, 8 |
| `TaskDetail.tsx` | 2, 4, 5, 6, 7 |
| `PreviewActions.tsx` | 3, 7 |
| `actions/route.ts` | 2 |
| `hooks/index.ts` | 2 |
| **New: `EditTaskDialog.tsx`** | 2, 8 |
| **New: `useKeyboardShortcuts.ts`** | 5 |
| **New: `KeyboardShortcutsDialog.tsx`** | 5 |
| **New: `useTheme.ts`** | 7 |
| **New: `BranchCleanupDialog.tsx`** | 9 |
| **New: `branches/route.ts`** | 9 |

---

**Total new lines**: ~1,500-1,800
**Total files modified**: ~12 existing + ~6 new = ~18 files
