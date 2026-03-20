# Plan: 260315-auto-890 — Student Statistics Dashboard

## Rerun Context

This is a rerun triggered via `/cody rerun` with no specific issues identified. Previous run artifacts (plan.md, build.md, review.md) were not found in prev-run directory, so this is treated as a fresh plan. The approach is a complete redesign with proper step-by-step TDD structure.

## Research Findings

### File Paths Verified
- ✅ `src/server/payload/collections/UserProgress.ts` — Existing collection with `progressRecords` array (recordType, recordId, completionPercentage, status, score, lastAccessedAt)
- ✅ `src/server/payload/collections/Conversations.ts` — Existing collection with user, contextRef, messages array
- ✅ `src/server/payload/collections/Courses.ts` — slug: 'courses', has title, slug, status, isActive
- ✅ `src/server/payload/collections/Chapters.ts` — slug: 'chapters', has course relationship, title, order
- ✅ `src/server/payload/collections/Lessons.ts` — slug: 'lessons', has chapter relationship, type (learning/practice/exam), title, order
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CoursePageContent/index.tsx` — Has "statsAndPerformance" button at line 82-85
- ✅ `src/app/(frontend)/courses/[courseSlug]/_components/CourseTabs/index.tsx` — Has TAB_COLORS constant (lines 8-13)
- ✅ `src/app/(frontend)/account/_components/AccountHub.tsx` — Has accordion sections, VALID_SECTIONS array
- ✅ `src/ui/web/providers/index.tsx` — Providers wrapper (ThemeProvider, AnalyticsProvider, HeaderThemeProvider)
- ✅ `src/ui/web/components/card.tsx` — Card, CardHeader, CardTitle, CardContent, CardFooter
- ✅ `src/ui/web/components/progress.tsx` — Progress bar component
- ✅ `src/ui/web/components/select.tsx` — Select component (shadcn)
- ✅ `src/ui/web/components/badge.tsx` — Badge component
- ✅ `src/app/api/user-settings/route.ts` — Reference API route pattern (auth pattern with payload.auth)
- ✅ `src/i18n/en.json` — Has "viewStats", "statsAndPerformance" keys in coursePage namespace
- ✅ `src/i18n/he.json` — Has matching Hebrew translations
- ✅ `src/server/payload/access/authenticated.ts` — Reusable access control
- ✅ `src/server/payload/access/authenticatedOrOwner.ts` — Owner-scoped access control
- ✅ `src/payload.config.ts` — Main config, must register new collections
- 🆕 `src/server/payload/collections/UserStats.ts` — New collection for stats (timeSpent, streak, activity log)
- 🆕 `src/app/api/stats/dashboard/route.ts` — Dashboard API endpoint
- 🆕 `src/app/api/stats/heartbeat/route.ts` — Heartbeat API endpoint
- 🆕 `src/app/api/stats/streak/route.ts` — Streak API endpoint
- 🆕 `src/app/api/stats/activity/route.ts` — Activity API endpoint
- 🆕 `src/app/(frontend)/stats/page.tsx` — Dashboard page
- 🆕 `src/app/(frontend)/stats/_components/` — Dashboard components directory
- 🆕 `src/client/hooks/useActiveTimeTracker.ts` — Heartbeat/visibility tracker hook
- 🆕 `src/client/providers/ActiveTimeProvider.tsx` — App-level time tracking provider

### Patterns Observed
- API routes use `getPayload({ config })` + `payload.auth({ headers: req.headers })` for auth
- Collections use access control from `src/server/payload/access/`
- Frontend uses `useTranslations` from `@/ui/web/providers/I18n`
- Navigation uses `SystemLink` from `@/infra/loading/components/SystemLink`
- Card-based layout uses shadcn Card components from `@/ui/web/components/card`
- Lesson types: 'learning', 'practice', 'exam' — maps to dashboard categories

### Integration Points
- Must register UserStats in `payload.config.ts` collections array
- Must add stats route in `src/app/(frontend)/stats/` directory
- Must update CoursePageContent to link to stats page
- Must update AccountHub to include stats link
- Must add ActiveTimeProvider to layout or providers
- Must add translation keys to both en.json and he.json
- Must run `pnpm generate:types` after schema changes

## Reuse Inventory

### Existing Utilities/Functions to Reuse
- `authenticated` from `src/server/payload/access/authenticated.ts` — for create access
- `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts` — for read/update access
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — for delete access
- `tenantField` from `src/server/payload/fields/tenant` — for tenant scoping
- `Card, CardHeader, CardTitle, CardContent` from `@/ui/web/components/card` — for dashboard cards
- `Progress` from `@/ui/web/components/progress` — for progress bars
- `Select` from `@/ui/web/components/select` — for course filter dropdown
- `Badge` from `@/ui/web/components/badge` — for streak/status badges
- `SystemLink` from `@/infra/loading/components/SystemLink` — for navigation
- `TAB_COLORS` from `src/app/(frontend)/courses/[courseSlug]/_components/CourseTabs/index.tsx` — for category colors
- `cn` from `@/infra/utils/ui` — for class merging
- `useTranslations` from `@/ui/web/providers/I18n` — for i18n

### Justification for New Code
- `UserStats` collection — UserProgress doesn't have fields for timeSpent, streak, or activity log
- API routes — No existing stats endpoints exist
- Dashboard page/components — Entirely new feature
- ActiveTimeProvider — No existing time tracking exists in the codebase

---

## Steps

### Step 1: Create UserStats Collection Schema

**Spec Refs**: FR-008, FR-009, FR-011
**Files to Touch**:
- `src/server/payload/collections/UserStats.ts` (NEW) — New collection for stats
- `src/payload.config.ts` (MODIFIED, line ~31 for import, line ~154 in collections array) — Register collection

**Exact Behavior**:
Create a `UserStats` collection to store per-user statistics data that doesn't fit in UserProgress:
- `user` (relationship to users, required, indexed, unique per user)
- `totalTimeSpentSeconds` (number, default 0) — cumulative active time in seconds
- `currentStreak` (number, default 0) — consecutive days count
- `longestStreak` (number, default 0) — historical max
- `lastActiveDate` (text, YYYY-MM-DD format) — last day counted for streak
- `lastHeartbeatAt` (date) — timestamp of last heartbeat received
- `activityLog` (array, max 50 items):
  - `actionType` (select: 'lesson_completed', 'exercise_attempted', 'exercise_completed', 'question_asked', 'conversation_started')
  - `label` (text) — human-readable description (e.g., "Completed Lesson 3")
  - `targetId` (text) — ID of the entity
  - `targetCollection` (text) — collection slug
  - `timestamp` (date)

Access: create=authenticated, read=authenticatedOrOwner, update=authenticatedOrOwner, delete=adminOnly

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/collections/user-stats.int.spec.ts`
- Test 1: `UserStats collection exists and accepts valid data` — Create a UserStats doc with all fields, verify it persists
- Test 2: `authenticatedOrOwner access prevents reading others' stats` — Create stats for user A, verify user B cannot read them with overrideAccess: false

**Acceptance Criteria**:
- [ ] UserStats collection registered in payload.config.ts
- [ ] All fields defined with correct types and defaults
- [ ] Access control uses existing access functions
- [ ] `pnpm generate:types` runs successfully

---

### Step 2: Create Heartbeat and Streak API Endpoints

**Spec Refs**: FR-008, FR-009, FR-010
**Files to Touch**:
- `src/app/api/stats/heartbeat/route.ts` (NEW) — POST endpoint for heartbeat
- `src/app/api/stats/streak/route.ts` (NEW) — POST endpoint for streak update

**Exact Behavior**:

**POST /api/stats/heartbeat**:
- Auth: Requires authenticated user (401 if not)
- Input: `{ seconds: number }` (30-60 range, validated with Zod)
- Logic: Find or create UserStats for user. Increment `totalTimeSpentSeconds` by `seconds`. Update `lastHeartbeatAt` to now.
- Response: `{ success: true, totalTimeSpentSeconds: number }`
- Error: 400 for invalid input, 401 for unauthenticated

**POST /api/stats/streak**:
- Auth: Requires authenticated user (401 if not)
- Input: `{}` (empty body — streak update is idempotent for the current day)
- Logic:
  1. Get today's date as YYYY-MM-DD
  2. Find or create UserStats for user
  3. If `lastActiveDate` === today → no-op (already counted)
  4. If `lastActiveDate` === yesterday → increment `currentStreak` by 1
  5. If `lastActiveDate` < yesterday → reset `currentStreak` to 1
  6. Update `lastActiveDate` to today
  7. Update `longestStreak` if `currentStreak` exceeds it
- Response: `{ success: true, currentStreak: number, longestStreak: number }`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/api/stats-heartbeat.int.spec.ts`
- Test 1: `POST /api/stats/heartbeat increments time` — Send heartbeat with seconds=30, verify totalTimeSpentSeconds increases
- Test 2: `POST /api/stats/heartbeat returns 401 without auth` — No auth header → 401
- Test location: `tests/int/api/stats-streak.int.spec.ts`
- Test 3: `POST /api/stats/streak increments streak for consecutive days` — Set lastActiveDate to yesterday, call streak, verify currentStreak increases
- Test 4: `POST /api/stats/streak resets streak after gap` — Set lastActiveDate to 3 days ago, call streak, verify currentStreak resets to 1

**Acceptance Criteria**:
- [ ] Heartbeat endpoint increments time and updates lastHeartbeatAt
- [ ] Streak endpoint correctly handles consecutive days, gaps, and same-day idempotency
- [ ] Both endpoints return 401 for unauthenticated requests
- [ ] Input validation with Zod on heartbeat endpoint

---

### Step 3: Create Dashboard and Activity API Endpoints

**Spec Refs**: FR-003, FR-004, FR-005, FR-007, FR-010
**Files to Touch**:
- `src/app/api/stats/dashboard/route.ts` (NEW) — GET endpoint for dashboard data
- `src/app/api/stats/activity/route.ts` (NEW) — GET endpoint for activity timeline

**Exact Behavior**:

**GET /api/stats/dashboard?courseId=xxx&timeframe=overall|week|month**:
- Auth: Requires authenticated user
- Logic:
  1. Fetch UserStats for the user
  2. Fetch UserProgress for the user
  3. Filter progressRecords by courseId (if provided) — look up chapters by courseId, then lessons by chapter, then filter records
  4. Calculate:
     - `totalProgress`: avg completionPercentage across lesson records
     - `timeSpent`: totalTimeSpentSeconds from UserStats
     - `averageScore`: mean of `score` from exercise records where score is not null
     - `dailyStreak`: currentStreak from UserStats
  5. Progress by category (filter by timeframe on lastAccessedAt):
     - `learn`: Count of lesson records with recordType='lesson' AND status='completed' (only for lessons with type='learning')
     - `practice`: Count attempted (recordType='exercise' where lesson type='practice') vs completed
     - `exams`: Scores and completion for lessons with type='exam'
     - `ask`: Count conversations for user (filtered by courseId context if provided)
  6. Topic mastery: Group exercise records by chapter, calculate (correct exercises / total attempted exercises * 100) per chapter
- Response: JSON with `summary`, `categoryProgress`, `topicMastery` sections

**GET /api/stats/activity?limit=10**:
- Auth: Requires authenticated user
- Logic: Fetch UserStats.activityLog for user, sort by timestamp desc, limit to `limit` (default 10, max 50)
- Response: `{ activities: Array<{ actionType, label, timestamp, targetId, targetCollection }> }`

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/api/stats-dashboard.int.spec.ts`
- Test 1: `GET /api/stats/dashboard returns summary data` — Create UserProgress with records, UserStats with time/streak, verify response has all summary fields
- Test 2: `GET /api/stats/dashboard filters by courseId` — Create records for 2 courses, query with courseId filter, verify only that course's data returned
- Test location: `tests/int/api/stats-activity.int.spec.ts`
- Test 3: `GET /api/stats/activity returns activities sorted by timestamp desc` — Add 3 activities, verify order

**Acceptance Criteria**:
- [ ] Dashboard endpoint returns all 4 summary metrics
- [ ] Dashboard endpoint correctly filters by courseId and timeframe
- [ ] Category progress uses correct lesson type mapping (learning→learn, practice→practice, exam→exams)
- [ ] Topic mastery uses Practice Success Rate formula from clarified.md
- [ ] Activity endpoint returns sorted, limited results
- [ ] Both endpoints return 401 for unauthenticated requests

---

### Step 4: Create Active Time Tracking Client Hook and Provider

**Spec Refs**: FR-008, FR-009
**Files to Touch**:
- `src/client/hooks/useActiveTimeTracker.ts` (NEW) — Hook for visibility-aware heartbeat
- `src/client/providers/ActiveTimeProvider.tsx` (NEW) — Provider wrapping the app
- `src/app/(frontend)/layout.tsx` (MODIFIED, lines ~72-84) — Add ActiveTimeProvider

**Exact Behavior**:

**useActiveTimeTracker hook**:
- Starts a 30-second interval timer when tab is visible
- Uses `document.addEventListener('visibilitychange', ...)` to pause/resume
- On each tick (30s): POST /api/stats/heartbeat with `{ seconds: 30 }`
- Tracks cumulative active seconds in-memory. When cumulative ≥ 300 (5 min): POST /api/stats/streak (once per day)
- Only runs when user is authenticated (checked via prop or context)
- Cleans up on unmount

**ActiveTimeProvider**:
- Client component ('use client')
- Wraps children, calls useActiveTimeTracker internally
- Accepts `isAuthenticated: boolean` prop
- Renders children without visual output

**Layout integration**:
- Add ActiveTimeProvider inside the Providers wrapper, around `{children}`
- Pass authentication state

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/hooks/useActiveTimeTracker.test.ts`
- Test 1: `sends heartbeat every 30 seconds when tab is visible` — Use fake timers, verify fetch called with correct endpoint after 30s
- Test 2: `pauses heartbeat when tab becomes hidden` — Dispatch visibilitychange event with hidden state, advance timer, verify no fetch call
- Test 3: `sends streak update after 5 minutes of active time` — Advance timer by 300s, verify streak endpoint called

**Acceptance Criteria**:
- [ ] Timer starts on mount and pauses on tab hidden (visibilitychange)
- [ ] Heartbeat POST fires every 30 seconds of active time
- [ ] Streak POST fires once after 5 cumulative minutes per day
- [ ] No memory leaks — cleanup on unmount
- [ ] Only active when user is authenticated

---

### Step 5: Create Dashboard Page and Summary Cards

**Spec Refs**: FR-001, FR-002, FR-003, FR-012
**Files to Touch**:
- `src/app/(frontend)/stats/page.tsx` (NEW) — Dashboard page (server component)
- `src/app/(frontend)/stats/_components/StatsDashboard.tsx` (NEW) — Main dashboard client component
- `src/app/(frontend)/stats/_components/SummaryCards.tsx` (NEW) — Four summary metric cards
- `src/app/(frontend)/stats/_components/DashboardFilters.tsx` (NEW) — Course and timeframe filters
- `src/i18n/en.json` (MODIFIED) — Add stats dashboard translations
- `src/i18n/he.json` (MODIFIED) — Add stats dashboard Hebrew translations

**Exact Behavior**:

**stats/page.tsx** (Server Component):
- Auth gate: redirect to /login if not authenticated
- Read `searchParams.courseId` for initial course context
- Fetch user's enrolled courses list
- Render StatsDashboard with initial data

**StatsDashboard.tsx** (Client Component):
- State: `courseId` (string | 'all'), `timeframe` ('week' | 'month' | 'overall')
- Fetches GET /api/stats/dashboard with current filters on mount and filter change
- Renders DashboardFilters + SummaryCards + (placeholder for category/mastery sections from Steps 6-7)

**SummaryCards.tsx**:
- 4 cards in a responsive grid (2x2 on mobile, 4 across on desktop)
- Each card uses shadcn `Card` component
- Total Progress: circular/bar progress display with percentage
- Time Spent: formatted as hours:minutes
- Average Score: percentage with color indicator
- Daily Streak: number with flame icon and "days" label

**DashboardFilters.tsx**:
- Course filter: shadcn Select with "All Courses" + enrolled courses
- Timeframe filter: 3 toggle buttons ("This Week", "This Month", "Overall")
- Calls parent onChange handlers

**Translations** (add to `stats` namespace in both en.json and he.json):
- `stats.title`, `stats.totalProgress`, `stats.timeSpent`, `stats.averageScore`, `stats.dailyStreak`
- `stats.allCourses`, `stats.thisWeek`, `stats.thisMonth`, `stats.overall`
- `stats.days`, `stats.hours`, `stats.minutes`

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/components/SummaryCards.test.tsx`
- Test 1: `SummaryCards renders all four metrics` — Render with mock data, verify 4 cards present with correct labels
- Test 2: `SummaryCards formats time correctly` — Pass 3661 seconds, verify "1h 1m" display
- Test location: `tests/unit/components/DashboardFilters.test.tsx`
- Test 3: `DashboardFilters calls onChange when course selected` — Click dropdown, select course, verify callback

**Acceptance Criteria**:
- [ ] Dashboard page accessible at /stats route
- [ ] Course filter dropdown shows "All Courses" and enrolled courses
- [ ] Timeframe toggle switches between week/month/overall
- [ ] All four summary cards display with correct formatting
- [ ] Translation keys exist in both en.json and he.json

---

### Step 6: Create Category Progress and Topic Mastery Sections

**Spec Refs**: FR-004, FR-005, FR-006
**Files to Touch**:
- `src/app/(frontend)/stats/_components/CategoryProgress.tsx` (NEW) — Progress by category section
- `src/app/(frontend)/stats/_components/TopicMastery.tsx` (NEW) — Topic mastery with drill-down
- `src/app/(frontend)/stats/_components/GapRecommendation.tsx` (NEW) — Sequential gap-filling recommendations

**Exact Behavior**:

**CategoryProgress.tsx**:
- Displays 4 category cards with exact HSL colors from TAB_COLORS:
  - Learn (blue): "X lessons completed" with progress bar
  - Practice (red): "X/Y exercises (Z% success)" with bar
  - Exams (pink): "Average score: X%" with bar
  - Ask (green): "X questions asked, Y conversations" with count
- Import TAB_COLORS from `@/app/(frontend)/courses/[courseSlug]/_components/CourseTabs`
- Each card has a colored left border or header accent using the HSL color

**TopicMastery.tsx**:
- Lists chapters with success rate percentages
- Each item shows chapter title + "X%" with color coding (green ≥ 70%, yellow ≥ 40%, red < 40%)
- Topic mastery formula: (correct practice exercises / total attempted) * 100 (from clarified.md)
- Clicking on a low-scoring topic opens GapRecommendation

**GapRecommendation.tsx**:
- Takes chapterId, user progress data as props
- Implements Sequential Gap-Filling logic:
  1. Find first lesson in chapter with status !== 'completed' → show "Continue: [Lesson Title]" with SystemLink
  2. If all lessons completed: find practice sub-topic with lowest success rate → show "Practice: [Topic]"
  3. If 100% complete: show "Review: Chapter Summary"
- Renders as a small card/tooltip below the clicked topic

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/components/CategoryProgress.test.tsx`
- Test 1: `CategoryProgress uses exact TAB_COLORS HSL values` — Render with mock data, verify style attributes contain correct HSL strings
- Test 2: `CategoryProgress shows all 4 categories` — Verify learn, practice, exams, ask sections present
- Test location: `tests/unit/components/TopicMastery.test.tsx`
- Test 3: `TopicMastery shows chapter success rates` — Render with 3 chapters, verify percentages displayed
- Test location: `tests/unit/components/GapRecommendation.test.tsx`
- Test 4: `GapRecommendation suggests first incomplete lesson` — Pass data with incomplete lesson, verify lesson name shown
- Test 5: `GapRecommendation suggests weakest practice when all lessons done` — All lessons completed, verify practice suggestion

**Acceptance Criteria**:
- [ ] Category progress uses exact HSL values from TAB_COLORS (imported, not duplicated)
- [ ] Topic mastery uses Practice Success Rate formula (correct/attempted * 100)
- [ ] Gap-filling follows the 3-step priority: Incomplete Lesson → Weakest Practice → Summary
- [ ] Clicking a low topic score shows recommendation
- [ ] Each recommendation links to the appropriate content via SystemLink

---

### Step 7: Create Activity Timeline and Wire Entry Points

**Spec Refs**: FR-001, FR-007, FR-011
**Files to Touch**:
- `src/app/(frontend)/stats/_components/ActivityTimeline.tsx` (NEW) — Recent activity timeline
- `src/app/(frontend)/courses/[courseSlug]/_components/CoursePageContent/index.tsx` (MODIFIED, lines 82-85) — Wire stats button
- `src/app/(frontend)/account/_components/AccountHub.tsx` (MODIFIED, lines ~18, ~55-82) — Add stats link

**Exact Behavior**:

**ActivityTimeline.tsx**:
- Fetches GET /api/stats/activity?limit=10
- Renders chronological list of last 10 actions
- Each item shows: icon (based on actionType), label text, relative timestamp (e.g., "2 hours ago")
- Action type icons: lesson_completed (✓), exercise_attempted (📝), question_asked (💬), conversation_started (🗨️)
- Empty state: "No activity yet. Start learning to see your progress!"

**CoursePageContent update (FR-001)**:
- Change the "statsAndPerformance" `<button>` at line 82-85 to a `<SystemLink>` pointing to `/stats?courseId={course.id}`
- Keep the same BarChart3 icon and translation key

**AccountHub update (FR-001)**:
- Add a new link/section in the account page that links to `/stats` (no courseId → defaults to "All Courses")
- Add SystemLink with text from t('auth.account.sectionStats') or similar key
- Add it as a visible link above or within the accordion, not a new accordion section

**Tests** (FAIL before, PASS after):
- Test location: `tests/unit/components/ActivityTimeline.test.tsx`
- Test 1: `ActivityTimeline renders last 10 actions` — Mock fetch with 10 activities, verify all rendered
- Test 2: `ActivityTimeline shows empty state when no activities` — Mock empty response, verify empty state text
- Test location: `tests/unit/components/CoursePageContent-stats.test.tsx`
- Test 3: `CoursePageContent stats button links to /stats with courseId` — Render CoursePageContent, verify the stats button is a link with correct href
- Test location: `tests/unit/components/AccountHub-stats.test.tsx`
- Test 4: `AccountHub shows My Progress & Stats link` — Render AccountHub, verify stats link present with href="/stats"

**Acceptance Criteria**:
- [ ] ActivityTimeline shows last 10 actions chronologically
- [ ] CoursePageContent stats button navigates to /stats?courseId=xxx
- [ ] Account page has "My Progress & Stats" link navigating to /stats
- [ ] Both entry points use SystemLink component
- [ ] Translation keys added for both entry points in en.json and he.json

---

### Step 8: Activity Logging Hook Integration

**Spec Refs**: FR-011
**Files to Touch**:
- `src/server/payload/hooks/stats/logActivity.ts` (NEW) — Reusable afterChange hook for activity logging
- `src/server/payload/collections/UserProgress.ts` (MODIFIED, add afterChange hook) — Log lesson/exercise completion
- `src/server/payload/collections/Conversations.ts` (MODIFIED, add afterChange hook on create) — Log question asked

**Exact Behavior**:

**logActivity hook factory**:
- Takes `actionType` and `labelFn` (function to derive label from doc)
- On afterChange (create or update with status changing to 'completed'):
  1. Get the user from req
  2. Find or create UserStats for user
  3. Push new activity entry to activityLog array (prepend)
  4. Trim activityLog to max 50 items
- Uses `context.skipActivityLog` flag to prevent infinite loops
- Always passes `req` for transaction safety

**UserProgress hook**:
- On afterChange: when a progressRecord's status changes to 'completed', log activity with type based on recordType (lesson_completed, exercise_completed)
- Label: "Completed [Lesson/Exercise Title]" (fetch title from related collection)

**Conversations hook**:
- On afterChange with operation='create': log activity with type 'conversation_started'
- Label: "Started a conversation about [context title]"

**Tests** (FAIL before, PASS after):
- Test location: `tests/int/hooks/logActivity.int.spec.ts`
- Test 1: `logActivity adds entry to UserStats activityLog` — Trigger a UserProgress update with status='completed', verify UserStats.activityLog has new entry
- Test 2: `logActivity trims activityLog to 50 max items` — Pre-fill with 50 items, trigger another, verify length stays 50

**Acceptance Criteria**:
- [ ] Activity logged when lessons/exercises are completed
- [ ] Activity logged when new conversations are created
- [ ] activityLog never exceeds 50 entries
- [ ] No infinite hook loops (context.skipActivityLog flag)
- [ ] req passed to all nested operations for transaction safety

---

### Step 9: Type Generation, Translation Completion, and Final Verification

**Spec Refs**: FR-012, All acceptance criteria
**Files to Touch**:
- `src/i18n/en.json` (MODIFIED) — Complete all stats translation keys
- `src/i18n/he.json` (MODIFIED) — Complete all stats Hebrew translation keys
- Run: `pnpm generate:types`
- Run: `pnpm generate:importmap`

**Exact Behavior**:

**Translation keys to add** (nested under `stats` namespace):

English (en.json):
```json
"stats": {
  "title": "My Statistics",
  "totalProgress": "Total Progress",
  "timeSpent": "Time Spent",
  "averageScore": "Average Score",
  "dailyStreak": "Daily Streak",
  "allCourses": "All Courses",
  "thisWeek": "This Week",
  "thisMonth": "This Month",
  "overall": "Overall",
  "days": "days",
  "hours": "h",
  "minutes": "m",
  "categoryLearn": "Study",
  "categoryPractice": "Practice",
  "categoryExams": "Tests",
  "categoryAsk": "Ask",
  "lessonsCompleted": "lessons completed",
  "exercisesAttempted": "exercises attempted",
  "exercisesSuccessful": "successful",
  "questionsAsked": "questions asked",
  "conversationsStarted": "conversations",
  "topicMastery": "Topic Mastery",
  "recentActivity": "Recent Activity",
  "noActivity": "No activity yet. Start learning to see your progress!",
  "continue": "Continue",
  "practiceWeakest": "Practice",
  "reviewSummary": "Review Summary",
  "viewFullStats": "View Full Statistics",
  "myProgressAndStats": "My Progress & Stats"
}
```

Hebrew (he.json) — matching keys with Hebrew values.

**Verification commands**:
```bash
pnpm generate:types
pnpm generate:importmap
pnpm -s tsc --noEmit
pnpm -s lint
pnpm test:int -- --grep "user-stats|stats-heartbeat|stats-streak|stats-dashboard|stats-activity|logActivity"
```

**Tests** (FAIL before, PASS after):
- Test 1: `pnpm -s tsc --noEmit` passes with zero errors
- Test 2: `pnpm -s lint` passes with zero errors
- Test 3: All integration tests from Steps 1-3 and Step 8 pass

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Lint passes without errors
- [ ] All stats-related translation keys present in both en.json and he.json
- [ ] Generated types include UserStats collection
- [ ] All integration tests pass
- [ ] Dashboard accessible at /stats
- [ ] Entry points work from Course Page and Account Page
