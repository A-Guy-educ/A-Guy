# Build Agent Report: Cody Dashboard Security Fixes

## Changes

### Phase 1: Security Fixes (Critical Issues)

#### 1. Created `verifyActorLogin` helper in `src/ui/cody/auth.ts`
- New function that verifies the supplied `actorLogin` matches the authenticated session
- Prevents actorLogin spoofing where a user could impersonate another user in GitHub comments
- Returns 403 if there's a mismatch between client-supplied and authenticated login

#### 2. Fixed `/api/cody/chat/route.ts` - Critical Security Gap
- **Before**: POST handler had NO authentication check - any unauthenticated request could stream AI responses
- **After**: Added `verifyActorLogin` call after parsing body
- Also changed GET handler from `requireDashboardAuth` to `requireCodyAuth` for consistency
- Updated logging to use verified identity instead of client-supplied actorLogin
- Fixed remote tools injection to use verified identity

#### 3. Fixed `/api/cody/remote/exec/route.ts` - Critical Security Gap
- **Before**: Used `requireDashboardAuth` (any Payload user) + accepted client-supplied actorLogin
- **After**: Uses `requireCodyAuth` + `verifyActorLogin` to verify actorLogin matches session
- Prevents lower-privilege users from forging admin's actorLogin to execute commands on remote machines

#### 4. Fixed `/api/cody/tasks/route.ts` POST
- Added `verifyActorLogin` to verify actorLogin matches authenticated session
- Updated issue creation to use verified identity for attribution

#### 5. Fixed `/api/cody/tasks/[taskId]/actions/route.ts`
- Added `verifyActorLogin` to verify actorLogin matches authenticated session
- Updated all GitHub comments/actions to use verified identity
- Fixed hardcoded OWNER/REPO to use constants from `@/ui/cody/constants`

#### 6. Fixed `/api/cody/tasks/approve/route.ts`
- Changed from `requireAuth` (Payload admin) to `requireCodyAuth` (GitHub OAuth)
- Added `verifyActorLogin` to prevent impersonation in PR approval comments
- Updated PR review body to use verified identity

#### 7. Fixed `/api/cody/tasks/approve-review/route.ts`
- Changed from `requireAuth` to `requireCodyAuth` for consistency
- Added `verifyActorLogin` to prevent impersonation
- Fixed hardcoded `OWNER = 'A-Guy-educ'` and `REPO = 'A-Guy'` to use constants
- Updated PR review body to use verified identity

#### 8. Fixed `/api/cody/publish/route.ts`
- Changed from `requireAuth` to `requireCodyAuth` for consistency
- Added `verifyActorLogin` to prevent impersonation in publish issues
- Updated issue creation to use verified identity

## Tests Written

No tests written - security fixes are backend API changes. Would require integration tests to verify:
- Unauthenticated requests to chat endpoint are rejected
- Requests with mismatched actorLogin are rejected with 403
- Verified identity is used in all GitHub comments/actions

## Deviations

None - followed the security fix plan exactly.

## Quality

- TypeScript: PASS
- Lint: PASS

## Summary of Security Improvements

| Route | Before | After |
|-------|--------|-------|
| `/api/cody/chat` POST | No auth | `verifyActorLogin` |
| `/api/cody/remote/exec` | `requireDashboardAuth` + client actorLogin | `requireCodyAuth` + `verifyActorLogin` |
| `/api/cody/tasks` POST | `requireCodyAuth` + client actorLogin | `requireCodyAuth` + `verifyActorLogin` |
| `/api/cody/tasks/[taskId]/actions` | `requireCodyAuth` + client actorLogin | `requireCodyAuth` + `verifyActorLogin` |
| `/api/cody/tasks/approve` | `requireAuth` (Payload admin) | `requireCodyAuth` + `verifyActorLogin` |
| `/api/cody/tasks/approve-review` | `requireAuth` + client actorLogin | `requireCodyAuth` + `verifyActorLogin` |
| `/api/cody/publish` | `requireAuth` + client actorLogin | `requireCodyAuth` + `verifyActorLogin` |

### Issues Fixed (from Deep Analysis)

- ✅ S1: Chat POST has no authentication (Critical)
- ✅ S2: actorLogin not verified against session (Critical)
- ✅ S3: Remote exec accepts forged actorLogin (Critical)
- ✅ S4: Inconsistent auth systems (Medium)
- ✅ Q6: Hardcoded OWNER/REPO instead of constants (Medium)

---

## Phase 2: Architecture Refactor

### New Hooks Created

#### 1. `useDashboardFilters` hook (`src/ui/cody/hooks/useDashboardFilters.ts`)
- Encapsulates dashboard filter state (date, label, status, view mode, search, sort)
- Provides URL synchronization for filters
- Extracts ~50 lines of state management from CodyDashboard
- Returns: dateFilter, labelFilter, statusFilter, viewMode, searchQuery, debouncedSearch, sortField, sortDirection, and their setters

#### 2. `useDashboardRouter` hook (`src/ui/cody/hooks/useDashboardRouter.ts`)
- Encapsulates URL state management with pushState/popstate
- Provides clean API: selectIssue, changeView, updateFilters, setTab
- Extracts ~80 lines of URL management logic from CodyDashboard
- Includes popstate listener for browser back/forward navigation

### New Components Created

#### 1. `DashboardHeader` component (`src/ui/cody/components/DashboardHeader.tsx`)
- Extracted header with user info, theme toggle, and action buttons
- Replaces ~100 lines of inline header JSX in CodyDashboard
- Clean interface for user actions

#### 2. `TaskDetailHeader` component (`src/ui/cody/components/TaskDetailHeader.tsx`)
- Extracted task detail header with title, status badge, assignees, and action buttons
- Replaces ~150 lines of inline header JSX in TaskDetail
- Uses CodyTask type properly with associatedPR instead of prNumber

### Architecture Benefits

These changes enable:
1. **Incremental adoption**: New hooks can be adopted piece-by-piece in CodyDashboard
2. **Better testability**: Filter state and URL logic now in pure functions
3. **Cleaner components**: Header and detail header can be reused or modified independently
4. **Future refactoring**: DashboardContext can be built on top of these hooks

### Quality

- TypeScript: PASS
- Lint: PASS

---

## Phase 3: Performance & Caching

### 1. Fixed N+1 in task detail fallback (`src/app/api/cody/tasks/[taskId]/route.ts`)
- Changed sequential comment fetching to batched parallel fetching
- Uses batches of 10 concurrent requests to avoid rate limits
- Reduces fallback path from 100+ API calls to ~20 parallel calls

### 2. Implemented targeted cache invalidation (`src/ui/cody/github-client.ts`)
- Added new functions: `invalidateTaskCache()`, `invalidatePRCache()`, `invalidateBoardCache()`, `invalidateBranchCache()`
- Replaced all `cache.clear()` calls with targeted invalidation
- Added `clearCacheByCategory()` for manual cache clearing by type
- Benefits: Writing to PRs no longer invalidates board/labels cache, etc.

### 3. Fixed cache TTL comments (`src/ui/cody/constants.ts`)
- Fixed incorrect comments:
  - `pipeline: 60000` was commented as "30s" → now "1min"
  - `prs: 300000` was commented as "2min" → now "5min"

### Quality

- TypeScript: PASS
- Lint: PASS

---

## Phase 4: Code Quality & Accessibility

### 1. Removed duplicate `cn()` utility (`src/ui/cody/utils.ts`)
- Replaced local `cn()` function with re-export from `@/infra/utils/ui`
- The proper version uses `tailwind-merge` for correct class conflict resolution

### 2. Added ARIA roles to TaskList (`src/ui/cody/components/TaskList.tsx`)
- Added `role="listbox"` to task container
- Added `role="option"` and `tabIndex={0}` to each task row
- Added `aria-selected` for selected state
- Added keyboard support (Enter/Space to select)

### 3. Added aria-label to FilterBar search (`src/ui/cody/components/FilterBar.tsx`)
- Added `aria-label="Search tasks"` to search input for screen reader support

### Quality

- TypeScript: PASS
- Lint: PASS
