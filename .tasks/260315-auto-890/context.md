# Codebase Context: 260315-auto-890

## Files to Modify
- `src/payload.config.ts` (line ~31 import, line ~154 collections array) — Register UserStats collection
- `src/app/(frontend)/courses/[courseSlug]/_components/CoursePageContent/index.tsx` (lines 82-85) — Change button to SystemLink to /stats?courseId=xxx
- `src/app/(frontend)/account/_components/AccountHub.tsx` (lines ~18, ~55) — Add stats link
- `src/server/payload/collections/UserProgress.ts` (lines ~110) — Add afterChange hook for activity logging
- `src/server/payload/collections/Conversations.ts` (lines ~339) — Add afterChange hook for activity logging
- `src/app/(frontend)/layout.tsx` (lines ~72-84) — Add ActiveTimeProvider
- `src/i18n/en.json` (after line ~374) — Add stats translation keys
- `src/i18n/he.json` (after line ~374) — Add stats Hebrew translation keys

## Files to Create (NEW)
- `src/server/payload/collections/UserStats.ts` — New collection for stats (time, streak, activity)
- `src/app/api/stats/heartbeat/route.ts` — POST heartbeat endpoint
- `src/app/api/stats/streak/route.ts` — POST streak endpoint
- `src/app/api/stats/dashboard/route.ts` — GET dashboard data endpoint
- `src/app/api/stats/activity/route.ts` — GET activity timeline endpoint
- `src/client/hooks/useActiveTimeTracker.ts` — Visibility-aware heartbeat hook
- `src/client/providers/ActiveTimeProvider.tsx` — App-level time tracking provider
- `src/app/(frontend)/stats/page.tsx` — Dashboard page (server component)
- `src/app/(frontend)/stats/_components/StatsDashboard.tsx` — Main dashboard client component
- `src/app/(frontend)/stats/_components/SummaryCards.tsx` — Four summary metric cards
- `src/app/(frontend)/stats/_components/DashboardFilters.tsx` — Course and timeframe filters
- `src/app/(frontend)/stats/_components/CategoryProgress.tsx` — Progress by category section
- `src/app/(frontend)/stats/_components/TopicMastery.tsx` — Topic mastery with drill-down
- `src/app/(frontend)/stats/_components/GapRecommendation.tsx` — Sequential gap-filling recommendations
- `src/app/(frontend)/stats/_components/ActivityTimeline.tsx` — Recent activity timeline
- `src/server/payload/hooks/stats/logActivity.ts` — Reusable activity logging hook
- `tests/int/collections/user-stats.int.spec.ts` — Collection integration tests
- `tests/int/api/stats-heartbeat.int.spec.ts` — Heartbeat API tests
- `tests/int/api/stats-streak.int.spec.ts` — Streak API tests
- `tests/int/api/stats-dashboard.int.spec.ts` — Dashboard API tests
- `tests/int/api/stats-activity.int.spec.ts` — Activity API tests
- `tests/int/hooks/logActivity.int.spec.ts` — Activity logging hook tests
- `tests/unit/hooks/useActiveTimeTracker.test.ts` — Time tracker hook unit tests
- `tests/unit/components/SummaryCards.test.tsx` — Summary cards unit tests
- `tests/unit/components/DashboardFilters.test.tsx` — Filters unit tests
- `tests/unit/components/CategoryProgress.test.tsx` — Category progress unit tests
- `tests/unit/components/TopicMastery.test.tsx` — Topic mastery unit tests
- `tests/unit/components/GapRecommendation.test.tsx` — Gap recommendation unit tests
- `tests/unit/components/ActivityTimeline.test.tsx` — Activity timeline unit tests

## Files to Read (reference patterns)
- `src/app/api/user-settings/route.ts` — API route auth pattern (payload.auth + getPayload)
- `src/server/payload/collections/UserProgress.ts` — Collection pattern with authenticatedOrOwner access
- `src/server/payload/collections/Conversations.ts` — Collection with hooks pattern
- `src/app/(frontend)/courses/[courseSlug]/_components/CourseTabs/index.tsx` — TAB_COLORS constant
- `src/ui/web/components/card.tsx` — Card component pattern for dashboard
- `src/ui/web/components/progress.tsx` — Progress bar component
- `src/ui/web/providers/index.tsx` — Provider composition pattern
- `src/app/(frontend)/layout.tsx` — Layout provider integration

## Key Signatures
- `TAB_COLORS: Record<CourseTab, { text: string; stroke: string }>` from `src/app/(frontend)/courses/[courseSlug]/_components/CourseTabs/index.tsx`
- `authenticated: (args: AccessArgs<User>) => boolean` from `src/server/payload/access/authenticated.ts`
- `authenticatedOrOwner: Access` from `src/server/payload/access/authenticatedOrOwner.ts`
- `adminOnly: Access` from `src/server/payload/access/adminOnly.ts`
- `tenantField` from `src/server/payload/fields/tenant`
- `Card, CardHeader, CardTitle, CardContent, CardFooter` from `src/ui/web/components/card.tsx`
- `Progress` from `src/ui/web/components/progress.tsx`
- `SystemLink` from `src/infra/loading/components/SystemLink`
- `cn` from `src/infra/utils/ui`
- `useTranslations` from `src/ui/web/providers/I18n`
- `getPayload({ config })` from `payload` + `@payload-config`
- `payload.auth({ headers: req.headers })` — returns `{ user }` for auth check

## Reuse Inventory
- `authenticated` from `src/server/payload/access/authenticated.ts` — use for create access on UserStats
- `authenticatedOrOwner` from `src/server/payload/access/authenticatedOrOwner.ts` — use for read/update access on UserStats
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — use for delete access on UserStats
- `tenantField` from `src/server/payload/fields/tenant` — use for tenant scoping in UserStats
- `TAB_COLORS` from CourseTabs — import and use for category color coding (MUST NOT duplicate)
- `Card/CardHeader/CardTitle/CardContent` from `@/ui/web/components/card` — use for all dashboard cards
- `Progress` from `@/ui/web/components/progress` — use for progress bars
- `Select` from `@/ui/web/components/select` — use for course filter dropdown
- `Badge` from `@/ui/web/components/badge` — use for streak/status badges
- `SystemLink` from `@/infra/loading/components/SystemLink` — use for all navigation links
- `cn` from `@/infra/utils/ui` — use for conditional class merging
- `useTranslations` from `@/ui/web/providers/I18n` — use for all text labels
- `z` from `zod` — use for request validation in API endpoints

## Integration Points
- Must register UserStats in `payload.config.ts` collections array (line ~154)
- Must add `src/app/(frontend)/stats/` route directory for dashboard page
- Must update CoursePageContent stats button (line 82-85) to use SystemLink with href
- Must update AccountHub to add stats link
- Must add ActiveTimeProvider to layout.tsx providers chain
- Must add translation keys to both `src/i18n/en.json` and `src/i18n/he.json`
- Must run `pnpm generate:types` after adding UserStats collection
- Must run `pnpm generate:importmap` after adding new components

## Imports Verified
- `@/server/payload/access/authenticated` → exports `authenticated` ✅
- `@/server/payload/access/authenticatedOrOwner` → exports `authenticatedOrOwner` ✅
- `@/server/payload/access/adminOnly` → exports `adminOnly` ✅
- `@/server/payload/fields/tenant` → exports `tenantField` ✅
- `@/ui/web/components/card` → exports Card, CardHeader, CardTitle, CardContent, CardFooter ✅
- `@/ui/web/components/progress` → exports Progress ✅
- `@/ui/web/components/select` → exists ✅
- `@/ui/web/components/badge` → exists ✅
- `@/infra/loading/components/SystemLink` → used in CoursePageContent ✅
- `@/infra/utils/ui` → exports cn ✅
- `@/ui/web/providers/I18n` → exports useTranslations ✅
- `@payload-config` → default export config ✅

## Collection Schemas (for API logic)
- **UserProgress.progressRecords[]**: `{ recordType: 'chapter'|'lesson'|'exercise', recordId: string, completionPercentage: number, status: 'not_started'|'in_progress'|'completed', score: number|null, lastAccessedAt: date }`
- **Courses**: `{ id, title, slug, status, isActive, courseLabel }`
- **Chapters**: `{ id, course (rel), title, chapterLabel, order, status, isActive, slug }`
- **Lessons**: `{ id, chapter (rel), type: 'learning'|'practice'|'exam', title, order, status, isActive, slug }`
- **Conversations**: `{ id, user (rel), contextRef: { relationTo, value }, messages[], lastMessageAt }`
