# Codebase Context: 260315-auto-706

## Files to Modify
- `src/app/(frontend)/courses/_components/LessonCard/index.tsx` (all 53 lines, MODIFIED) — Add ContentStatusBadge display and locked behavior for "Soon" lessons

## Files to Create
- `tests/unit/components/LessonCard.test.tsx` (NEW) — Unit tests for LessonCard badge and locked behavior

## Files to Read (reference patterns)
- `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` — **Primary pattern**: Shows exact implementation of badge + locked behavior for lessons
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` — **Secondary pattern**: Shows badge + locked behavior for courses
- `tests/unit/components/CourseLessonCard.test.tsx` — Test pattern for lesson card with badge tests
- `tests/unit/components/CourseCard.test.tsx` — Test pattern for card with badge + disabled button tests

## Key Signatures
- `ContentStatusBadge({ contentStatus, contentStatusExpiresAt, className })` from `src/ui/web/shared/ContentStatusBadge/index.tsx`
- `toast.info(message: string)` from `sonner`
- `cn(...inputs: ClassValue[])` from `@/infra/utils/ui`
- `useTranslations(namespace: string)` from `@/ui/web/providers/I18n`
- `SystemLink({ href, children, ...props })` from `@/infra/loading/components/SystemLink`

## Reuse Inventory
- `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge` — renders badge with correct styling/expiry
- `toast` from `sonner` — shows locked message notification
- `cn` from `@/infra/utils/ui` — conditional class merging
- `useTranslations('courses')` — already used in LessonCard; namespace contains `contentLocked`, `soonBadge`, `justAddedBadge`
- `Card`, `CardHeader`, `CardTitle`, `CardFooter` from `@/ui/web/components/card` — already used in LessonCard
- `Button` from `@/ui/web/components/button` — already used in LessonCard
- `SystemLink` from `@/infra/loading/components/SystemLink` — already used in LessonCard

## Integration Points
- `LessonCard` is imported by `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` (line 16) — no changes needed to importing page
- `Lesson` type from `@/payload-types` already has `contentStatus: 'none' | 'soon' | 'justAdded'` and `contentStatusExpiresAt?: string | null`
- Translation keys already exist: `courses.contentLocked`, `courses.soonBadge`, `courses.justAddedBadge`

## Imports Verified
- `@/ui/web/shared/ContentStatusBadge` → exports `ContentStatusBadge` ✅
- `@/infra/utils/ui` → exports `cn` ✅
- `@/ui/web/providers/I18n` → exports `useTranslations`, `I18nProvider` ✅
- `@/payload-types` → exports `Lesson` type with contentStatus fields ✅
- `sonner` → exports `toast` ✅
- `@/infra/loading/components/SystemLink` → exports `SystemLink` ✅

## Test Configuration
- Test runner: vitest (NOT jest)
- Config: `vitest.config.unit.mts`
- Command: `pnpm vitest run --config vitest.config.unit.mts tests/unit/components/LessonCard.test.tsx`
- Environment: jsdom (`// @vitest-environment jsdom` at top of test file)
- i18n setup: Wrap components in `<I18nProvider locale="en" messages={enMessages}>`
- Mock pattern: Use `vi.mock('sonner', ...)` and `vi.mock('@/infra/loading/components/SystemLink', ...)`
