# Codebase Context: 260315-auto-706

## Files to Modify
- `src/server/payload/collections/Courses.ts` (lines 61-236) — add contentStatus fields before createdByField
- `src/server/payload/collections/Lessons.ts` (lines 51-256) — add contentStatus fields before createdByField
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (lines 1-132) — add badge display + locked click handler
- `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` (lines 1-89) — add badge display + locked click handler
- `src/i18n/en.json` (lines 130-179, courses section) — add soonBadge, justAddedBadge, contentLocked keys
- `src/i18n/he.json` (lines 130-179, courses section) — add soonBadge, justAddedBadge, contentLocked keys
- `tests/unit/components/CourseCard.test.tsx` (lines 1-131) — extend with badge and locked content tests

## Files to Create (NEW)
- `src/server/payload/fields/contentStatus.ts` — reusable field group for content status
- `src/ui/web/shared/ContentStatusBadge/index.tsx` — reusable badge component
- `tests/unit/fields/contentStatus.test.ts` — field definition tests
- `tests/unit/components/ContentStatusBadge.test.tsx` — badge component tests
- `tests/unit/components/CourseLessonCard.test.tsx` — lesson card tests
- `tests/unit/i18n/contentStatus-translations.test.ts` — translation key tests

## Files to Read (reference patterns)
- `src/server/payload/fields/contentLocale.ts` — pattern for reusable field definitions with exported Field type
- `src/server/payload/fields/createdBy.ts` — pattern for reusable field with hooks
- `src/ui/web/components/badge.tsx` — existing Badge component with CVA variants
- `src/ui/web/components/toaster.tsx` — Sonner toast setup (already configured)
- `src/server/payload/access/publishedAndActive.ts` — current read access (DO NOT MODIFY)
- `src/server/payload/access/adminOnly.ts` — write access pattern
- `tests/unit/components/CourseCard.test.tsx` — test pattern (vitest + testing-library + I18nProvider)
- `src/server/repos/queries/courses.ts` — how courses are fetched for listing page

## Key Signatures
- `export const contentStatusFields: Field[]` from `src/server/payload/fields/contentStatus.ts` (NEW)
- `export function ContentStatusBadge(props: ContentStatusBadgeProps)` from `src/ui/web/shared/ContentStatusBadge/index.tsx` (NEW)
- `export function CourseCard({ course, isOwned }: CourseCardProps)` from `src/app/(frontend)/courses/_components/CourseCard/index.tsx`
- `export function CourseLessonCard({ lesson, index, courseSlug, chapterSlug, tabColor }: CourseLessonCardProps)` from `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx`
- `export const publishedAndActive: Access` from `src/server/payload/access/publishedAndActive.ts`
- `export const adminOnly: AdminOnlyAccess` from `src/server/payload/access/adminOnly.ts`
- `export const Courses: CollectionConfig` from `src/server/payload/collections/Courses.ts`
- `export const Lessons: CollectionConfig` from `src/server/payload/collections/Lessons.ts`
- `toast` from `sonner` — `toast(message: string)` or `toast.info(message)` for notifications
- `useTranslations(namespace: string)` from `@/ui/web/providers/I18n`
- `cn(...classes)` from `@/infra/utils/ui`

## Reuse Inventory
- `adminOnly` from `src/server/payload/access/adminOnly.ts` — collection write access (unchanged)
- `publishedAndActive` from `src/server/payload/access/publishedAndActive.ts` — collection read access (DO NOT MODIFY)
- `Badge` from `src/ui/web/components/badge.tsx` — base shadcn badge (extended with custom classes in ContentStatusBadge)
- `cn` from `src/infra/utils/ui` — className merging
- `toast` from `sonner` — toast notifications for locked content
- `useTranslations` from `@/ui/web/providers/I18n` — i18n hook
- `createdByField` from `src/server/payload/fields/createdBy.ts` — spread into collection fields
- `contentLocaleField` from `src/server/payload/fields/contentLocale.ts` — existing reusable field pattern
- `I18nProvider` from `@/ui/web/providers/I18n` — test wrapper

## Integration Points
- Courses.ts fields array: spread `...contentStatusFields` before `createdByField` (line ~234)
- Lessons.ts fields array: spread `...contentStatusFields` before `createdByField` (line ~254)
- Courses.ts admin.defaultColumns: add `'contentStatus'` after `'isActive'` (line ~58)
- Lessons.ts admin.defaultColumns: add `'contentStatus'` after `'isActive'` (line ~48)
- en.json / he.json: add keys inside existing `"courses"` section
- CourseCard: import ContentStatusBadge, add to JSX + modify handleCourseSelect
- CourseLessonCard: import ContentStatusBadge, add to JSX + add click handler
- Must run `pnpm generate:types` after schema changes to update `src/payload-types.ts`
- Must run `pnpm generate:importmap` after adding new components

## Imports Verified
- `@/server/payload/access/adminOnly` → exports `adminOnly` ✅
- `@/server/payload/access/publishedAndActive` → exports `publishedAndActive` ✅
- `@/server/payload/fields/createdBy` → exports `createdByField` ✅
- `@/server/payload/fields/contentLocale` → exports `contentLocaleField` ✅
- `@/ui/web/components/badge` → exports `Badge`, `badgeVariants` ✅
- `@/ui/web/components/toaster` → exports `Toaster` (Sonner) ✅
- `@/infra/utils/ui` → exports `cn` ✅
- `@/ui/web/providers/I18n` → exports `useTranslations`, `I18nProvider` ✅
- `@/payload-types` → exports `Course`, `Lesson` (will include new fields after generate:types) ✅
- `sonner` → exports `toast` ✅
