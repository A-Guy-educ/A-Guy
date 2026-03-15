# Build Agent Report: cody-dashboard-improvements

## Changes (Session 2 — Items 2–18)

- **`src/ui/cody/components/PreviewModal.tsx`** — Items 2, 3, 8, 10, 18: Fixed Escape double-close (guard when selectedDoc open); added `loadError` state with retry banners in Changes + Docs tabs; added `commentCount` state + count badge on Comments tab via `onCountChange` callback; added `pb-20` to scroll container; added ARIA `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"` with matching `id`/`aria-labelledby`.
- **`src/ui/cody/components/TaskList.tsx`** — Items 4, 5, 6, 7, 9, 17: Moved `opacity-50` from entire row to content div only (status icon/bar remain full opacity); added `onCreateTask` prop with icon + descriptive text + "New Task" button empty state; bar pipeline progress row changed to desktop-only (`hidden sm:block`); removed `hidden sm:` from Timeout, Exhausted, Error badges (Needs Answer stays hidden); removed dead `transition-opacity duration-100` comment/classes; added `aria-label` on play/stop and preview eye buttons.
- **`src/ui/cody/components/PRCommentList.tsx`** — Item 8: Added `onCountChange?: (count: number) => void` prop; calls it after comments load.
- **`src/ui/cody/components/CodyDashboard.tsx`** — Items 5, 11, 12, 14, 15, 17: Passes `onCreateTask={handleOpenCreate}` to TaskList; reads `date`/`status`/`label`/`view`/`q` from URL search params as initial state; `replaceState` effect syncs non-default values back to URL; added `searchQuery` + `debouncedSearch` state with 300ms debounce; filters `filteredTasks` by title/issueNumber; passes `searchQuery`/`onSearchChange` to FilterBar; wraps return in `<ErrorBoundary>`; removed rate-limit and generic full-page error returns, replaced with dismissible inline `errorBannerMessage` banner (NoTokenError stays full-page); added `aria-label` on hamburger, refresh, and notification bell buttons.
- **`src/ui/cody/components/FilterBar.tsx`** — Item 12: Added `searchQuery`/`onSearchChange` props; renders search input with `Search` icon between ViewToggle and Date filter.
- **`src/ui/cody/components/PipelineStatus.tsx`** — Item 16: Replaced native `title` attribute with `SimpleTooltip` wrapping each `StageRow` inner div.
- **`src/ui/cody/components/TaskDetail.tsx`** — Items 13, 17, 18: Replaced `confirm()` in `OverflowMenu` with `ConfirmDialog` (stores pending action in state, renders after menu closes); added `aria-label` on close, back, and refresh buttons; added `role="tablist"`, `role="tab"`, `aria-selected`, `tabId`/`panelId` props to `TabButton`; added `role="tabpanel"` + `id`/`aria-labelledby` to tab content divs.
- **`src/ui/cody/components/PreviewActions.tsx`** — Item 13: Replaced `confirm()` with `showCancelConfirm` state + `<ConfirmDialog>`.
- **`src/ui/cody/components/CodyChat.tsx`** — Item 13: Replaced `window.confirm` with `showClearConfirm` state + `<ConfirmDialog>`; renamed handler to `executeClearHistory`.
- **`src/ui/cody/components/ConfirmDialog.tsx`** *(new)* — Item 13: Reusable accessible confirm dialog using shadcn Dialog with `open`, `title`, `description`, `confirmLabel`, `variant`, `onConfirm`, `onClose` props.
- **`src/ui/cody/components/ErrorBoundary.tsx`** *(new)* — Item 14: React class component error boundary with "Something went wrong" + "Reload" fallback.

## Tests Written

None — these are pure UI/UX changes with no business logic functions.

## Quality

- TypeScript: PASS
- Lint: PASS (no warnings or errors)
