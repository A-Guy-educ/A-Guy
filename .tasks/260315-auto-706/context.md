# Codebase Context: 260315-auto-706

## Files to Modify
- `src/app/(frontend)/courses/_components/LessonCard/index.tsx` (lines 67-77) — Fix invalid HTML nesting: replace `<Button asChild={!isSoon}><SystemLink>` with conditional render (standalone Button for locked, Button+asChild+SystemLink for normal)
- `tests/unit/components/LessonCard.test.tsx` (lines 12, 116-134) — Update tests for new conditional structure; fix `any` type; add disabled button test

## Files to Read (reference patterns)
- `src/app/(frontend)/courses/_components/CourseCard/index.tsx` (lines 129-149) — **Key pattern**: standalone `<Button onClick={handler} disabled={isSoon}>` for locked state, no SystemLink wrapping
- `src/app/(frontend)/courses/[courseSlug]/_components/CourseLessonCard/index.tsx` (lines 63-70) — **Alternative pattern**: single `<SystemLink>` wrapper with `cursor-not-allowed`
- `src/ui/web/components/button.tsx` (lines 39-49) — Button component: `asChild ? Slot : 'button'` — explains why nesting `<a>` inside non-asChild Button produces invalid HTML
- `tests/unit/components/CourseLessonCard.test.tsx` — Test pattern with `vi.mock('sonner')` and `vi.mock('SystemLink')`

## Key Signatures
- `ContentStatusBadge({ contentStatus, contentStatusExpiresAt, className })` from `src/ui/web/shared/ContentStatusBadge/index.tsx`
- `toast.info(message: string)` from `sonner`
- `cn(...inputs: ClassValue[])` from `@/infra/utils/ui`
- `useTranslations(namespace: string)` from `@/ui/web/providers/I18n`
- `SystemLink({ href, children, ...props })` from `@/infra/loading/components/SystemLink`
- `Button({ asChild?, disabled?, onClick?, className?, children })` from `@/ui/web/components/button` — when `asChild=false`, renders as `<button>`; when `asChild=true`, renders as `<Slot>` (passes props to child)

## Reuse Inventory
- `ContentStatusBadge` from `@/ui/web/shared/ContentStatusBadge` — renders badge with correct styling/expiry ✅
- `toast` from `sonner` — shows locked message notification ✅
- `cn` from `@/infra/utils/ui` — conditional class merging ✅
- `useTranslations('courses')` — already used in LessonCard; namespace contains `contentLocked` ✅
- `Button` from `@/ui/web/components/button` — standalone disabled button for locked state ✅
- `SystemLink` from `@/infra/loading/components/SystemLink` — only rendered for non-locked lessons ✅

## Integration Points
- `LessonCard` imported by `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/page.tsx` (line 16) — no changes needed
- `Lesson` type from `@/payload-types` already has `contentStatus: 'none' | 'soon' | 'justAdded'` and `contentStatusExpiresAt?: string | null`
- Translation keys: `courses.contentLocked`, `courses.soonBadge`, `courses.justAddedBadge` — all exist ✅

## Imports Verified
- `@/ui/web/shared/ContentStatusBadge` → exports `ContentStatusBadge` ✅
- `@/infra/utils/ui` → exports `cn` ✅
- `@/ui/web/providers/I18n` → exports `useTranslations`, `I18nProvider` ✅
- `@/payload-types` → exports `Lesson` type with contentStatus fields ✅
- `sonner` → exports `toast` ✅
- `@/infra/loading/components/SystemLink` → exports `SystemLink` ✅
- `@/ui/web/components/button` → exports `Button` with `asChild`, `disabled` props ✅

## Test Configuration
- Test runner: vitest (NOT jest)
- Config: `vitest.config.unit.mts`
- Command: `pnpm vitest run --config vitest.config.unit.mts tests/unit/components/LessonCard.test.tsx`
- Environment: jsdom (`// @vitest-environment jsdom` at top of test file)
- i18n setup: Wrap in `<I18nProvider locale="en" messages={enMessages}>`
- Mock pattern: `vi.mock('sonner', ...)` and `vi.mock('@/infra/loading/components/SystemLink', ...)`

## Critical Fix Context
The **only code change** is in `LessonCard/index.tsx` lines 67-77. Replace:
```tsx
// BEFORE (invalid HTML: <button><a>)
<Button asChild={!isSoon}>
  <SystemLink href={isSoon ? '#' : href} onClick={isSoon ? handleLessonClick : undefined} className={isSoon ? 'cursor-not-allowed' : undefined}>
    {t('viewLesson')}
  </SystemLink>
</Button>
```
With:
```tsx
// AFTER (valid HTML: conditional <button> or <a>)
{isSoon ? (
  <Button onClick={handleLessonClick} disabled className="cursor-not-allowed">
    {t('viewLesson')}
  </Button>
) : (
  <Button asChild>
    <SystemLink href={href}>{t('viewLesson')}</SystemLink>
  </Button>
)}
```
