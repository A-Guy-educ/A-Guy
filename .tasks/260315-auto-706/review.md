# Code Review: 260315-auto-706

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| §1.1 "Soon" badge on Course card | `CourseCard/index.tsx:84-88` | `CourseCard.test.tsx` (prior run) | ✅ Met |
| §1.1 "Soon" badge on Lesson card | `LessonCard/index.tsx:58-61` | `LessonCard.test.tsx:70-75` | ✅ Met |
| §1.1 "Soon" content locked - clicking shows message | `LessonCard/index.tsx:39-46`, `CourseCard/index.tsx:34-41` | `LessonCard.test.tsx:116-125` | ✅ Met |
| §1.2 "Just Added" badge on Course card | `CourseCard/index.tsx:84-88` | `CourseCard.test.tsx` (prior run) | ✅ Met |
| §1.2 "Just Added" badge on Lesson card | `LessonCard/index.tsx:58-61` | `LessonCard.test.tsx:77-82` | ✅ Met |
| §1.2 "Just Added" fully accessible | `LessonCard/index.tsx:70` (href set to real URL) | `LessonCard.test.tsx:143-155` | ✅ Met |
| §2.1 Status selector in admin (None/Soon/JustAdded) | `contentStatus.ts:22-36` | `contentStatus.test.ts` (prior run) | ✅ Met |
| §2.1 Visibility toggle for "Soon" | `contentStatus.ts:38-47` | `contentStatus.test.ts` (prior run) | ✅ Met |
| §2.1 Optional "New Until" date | `contentStatus.ts:48-56` | `contentStatus.test.ts` (prior run) | ✅ Met |
| §3.1 Pill-shaped badge styling (`rounded-full`, `text-xs`, bold) | `ContentStatusBadge/index.tsx:47,62` | `ContentStatusBadge.test.tsx` (prior run) | ✅ Met |
| §3.1 Badge placement: next to lesson title | `LessonCard/index.tsx:56-62` (flex gap-2 wrapper) | `LessonCard.test.tsx:70-82` (badge renders) | ✅ Met |
| §3.2 "Just Added" pulse animation | `ContentStatusBadge/index.tsx:63` (`animate-pulse`) | `ContentStatusBadge.test.tsx` (prior run) | ✅ Met |
| AC-1: Admins can mark lesson as "Soon" in Payload | `Lessons.ts:257` (contentStatusFields spread) | `contentStatus.test.ts` (prior run) | ✅ Met |
| AC-2: Students cannot access "Soon" content | `LessonCard/index.tsx:41-44` (preventDefault + toast) | `LessonCard.test.tsx:116-134` | ✅ Met |
| AC-3: "Just Added" badge appears immediately | `LessonCard/index.tsx:58-61`, `CourseCard/index.tsx:84-88` | `LessonCard.test.tsx:77-82` | ✅ Met |
| AC-4: Responsive design | `LessonCard/index.tsx:56` (flex items-center gap-2) | — | ⚠️ Untested (visual, E2E scope) |
| AC-5: "Soon" badge uses neutral color | `ContentStatusBadge/index.tsx:48` (`bg-muted text-muted-foreground`) | `ContentStatusBadge.test.tsx` (prior run) | ✅ Met |
| AC-6: "Just Added" badge uses bright color | `ContentStatusBadge/index.tsx:63` (`bg-emerald-500 text-white`) | `ContentStatusBadge.test.tsx` (prior run) | ✅ Met |
| AC-7: Badge uses Assistant Bold font at text-xs | `ContentStatusBadge/index.tsx:47,62` (`text-xs font-bold`) | `ContentStatusBadge.test.tsx` (prior run) | ✅ Met |
| AC-8: "Just Added" has pulse animation | `ContentStatusBadge/index.tsx:63` (`animate-pulse`) | `ContentStatusBadge.test.tsx` (prior run) | ✅ Met |
| AC-9: "New Until" date auto-removes badge | `ContentStatusBadge/index.tsx:34-40` (expiry check) | `LessonCard.test.tsx:92-101` | ✅ Met |
| Backend query filtering (invisible "Soon" hidden) | `queries/courses.ts:19,48`, `queries/lessons.ts:63-64,104-105,208-209` | `course-content-status.test.ts`, `lesson-content-status.test.ts` (prior run) | ✅ Met |
| Translations (EN + HE) | `en.json:261-263`, `he.json:261-263` | `contentStatus-translations.test.ts` (prior run) | ✅ Met |

**Spec Coverage**: 22/23 requirements met (96%), 1 visual/responsive requirement untested (appropriate for E2E scope)

## Code Quality Findings

### Critical

None.

### Major

- **[LessonCard/index.tsx:68-76] Invalid HTML nesting: `<button>` wrapping `<a>` when `isSoon` is true.** When `isSoon` is true, `asChild={false}` makes Button render as a `<button>` element, but the child is still `<SystemLink>` (renders `<a>`). This results in `<button><a href="#">...</a></button>`, which is invalid HTML (interactive element nested inside interactive element). This can cause unpredictable behavior across browsers and fails accessibility validation. The `CourseLessonCard` avoids this by using a single `<SystemLink>` wrapper. **Recommended fix**: When `isSoon`, render a standalone `<Button onClick={handleLessonClick} className="cursor-not-allowed">` without `<SystemLink>` inside, and only use `<Button asChild><SystemLink>` for the non-locked path. Example pattern:
  ```tsx
  {isSoon ? (
    <Button onClick={handleLessonClick} className="cursor-not-allowed">
      {t('viewLesson')}
    </Button>
  ) : (
    <Button asChild>
      <SystemLink href={href}>{t('viewLesson')}</SystemLink>
    </Button>
  )}
  ```

### Minor

- **[LessonCard/index.tsx:68] `Button` not disabled for "Soon" lessons.** The plan specified `disabled={isSoon}` on the Button (plan line 77), and the CourseCard uses `disabled={isSoon}` (CourseCard:131). The current implementation relies on `href="#"` + `onClick` preventDefault instead of actually disabling the button. While functionally similar, the `disabled` attribute provides better accessibility semantics (screen readers announce it as disabled). Adding `disabled={isSoon}` to the Button would improve a11y.
- **[LessonCard.test.tsx:12] `any` type in mock.** The SystemLink mock uses `any` for the props type. Should use a typed interface or `Record<string, unknown>` instead.
- **[LessonCard.test.tsx:65] Using `.toBeTruthy()` instead of `.toBeInTheDocument()`.** The test assertions use `.toBeTruthy()` which is less precise than `.toBeInTheDocument()` from `@testing-library/jest-dom`. While functional, it's a weaker assertion.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | No new access control functions created |
| No duplicated utilities | ✅ | Reuses existing `cn`, `toast`, `ContentStatusBadge` |
| No duplicated validation schemas | ✅ | N/A for this change |
| Existing UI components used where possible | ✅ | Reuses `ContentStatusBadge`, `Card`, `Button`, `SystemLink` |
| No `any` type escapes | ❌ | `any` used in test mock (minor, test-only) |
| Functions reasonably sized (<50 lines) | ✅ | LessonCard is 60 lines including JSX, reasonable |
| No magic numbers/strings | ✅ | Uses translation keys, no hardcoded strings |
| Error handling on all async ops | ✅ | No async operations in this change |

## Summary

- **Issues Found**: Yes (1 Major — invalid HTML nesting)
- **Spec Satisfied**: Yes — all functional requirements are implemented and tested
- **Recommendation**: Fix Required — the invalid HTML nesting of `<button><a>` when `isSoon=true` should be corrected to use a conditional render pattern (separate Button vs Button+SystemLink paths). This is a structural/accessibility issue, not a functional gap.
