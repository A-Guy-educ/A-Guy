# Code Review: 260315-auto-706

## Spec Satisfaction

| Requirement | Code Location | Test Coverage | Status |
|-------------|--------------|---------------|--------|
| AC-1: Admins can mark a lesson as "Soon" in Payload CMS admin | `src/server/payload/fields/contentStatus.ts:22-37` (select field with 'soon' option); `Courses.ts:237`, `Lessons.ts:257` (spread into collections) | `tests/unit/fields/contentStatus.test.ts:46-52` | ✅ Met |
| AC-2: Students cannot access "Soon" content – clicking shows locked message | `CourseCard/index.tsx:38-41` (toast on click, early return); `CourseLessonCard/index.tsx:46-52` (preventDefault + toast) | `CourseCard.test.tsx:171-184`; `CourseLessonCard.test.tsx:100-110` | ✅ Met |
| AC-3: "Just Added" badge appears immediately on course list when enabled | `CourseCard/index.tsx:84-88` (ContentStatusBadge rendered); `CourseLessonCard/index.tsx:81-84` | `CourseCard.test.tsx:155-160`; `CourseLessonCard.test.tsx:82-87` | ✅ Met |
| AC-4: Badges adapt to responsive design without overlapping title | `CourseCard/index.tsx:87` (`absolute -top-3 right-6` positioning); `CourseLessonCard/index.tsx:79` (inline flex with gap-2) | No specific responsive test | ⚠️ Untested |
| AC-5: "Soon" badge uses neutral color (Gray/Light Blue) | `ContentStatusBadge/index.tsx:48` (`bg-muted text-muted-foreground`) | `ContentStatusBadge.test.tsx:82-86` (checks no animate-pulse) | ⚠️ Untested (no color assertion) |
| AC-6: "Just Added" badge uses bright color (Green/Yellow) | `ContentStatusBadge/index.tsx:63` (`bg-emerald-500 text-white`) | `ContentStatusBadge.test.tsx:76-79` (checks animate-pulse class) | ⚠️ Untested (no color assertion) |
| AC-7: Badge uses Assistant Bold font at text-xs size | `ContentStatusBadge/index.tsx:47,62` (`text-xs font-bold`) | `ContentStatusBadge.test.tsx:88-92` (checks rounded-full) | ⚠️ Untested (font family not verified) |
| AC-8: "Just Added" badge has subtle pulse animation | `ContentStatusBadge/index.tsx:63` (`animate-pulse`) | `ContentStatusBadge.test.tsx:76-79` | ✅ Met |
| AC-9: Optional "New Until" date auto-removes badge after expiry | `ContentStatusBadge/index.tsx:34-40` (checks expiry date, returns null if past) | `ContentStatusBadge.test.tsx:56-63,65-72`; `CourseCard.test.tsx:197-217` | ✅ Met |
| FR-001: Content status field schema (3 fields) | `contentStatus.ts:22-57` | `contentStatus.test.ts:24-94` | ✅ Met |
| FR-002: Type generation | `payload-types.ts` updated (confirmed by grep) | N/A (build step) | ✅ Met |
| FR-003: Translation keys (both locales) | `en.json:261-263`; `he.json:261-263` | `contentStatus-translations.test.ts:11-64` | ✅ Met |
| FR-004: Access control – "Soon" with visible=false hidden from listings | NOT IMPLEMENTED | NO TEST | ❌ Missing |
| FR-005: Locked message display (toast) | `CourseCard/index.tsx:39`; `CourseLessonCard/index.tsx:50` | `CourseCard.test.tsx:182-183`; `CourseLessonCard.test.tsx:107-109` | ✅ Met |
| FR-006: Pulse animation | `ContentStatusBadge/index.tsx:63` | `ContentStatusBadge.test.tsx:76-79` | ✅ Met |
| Spec §2.1: Visibility toggle hides "Soon" content from students | Field exists (`contentStatusVisible`) but NOT consumed anywhere | NO TEST | ❌ Missing |

**Spec Coverage**: 13/15 requirements met (87%)

## Code Quality Findings

### Critical

- **[FR-004 / Spec §2.1] `contentStatusVisible` field is defined but never consumed** — The `contentStatusVisible` checkbox is added to both collections but is NOT used in:
  - `publishedAndActive.ts` (access control) — not modified
  - `queryPublishedCourses()` in `src/server/repos/queries/courses.ts` — no filter for `contentStatusVisible: false`
  - `queryLessonsByChapter()` / `queryLessonsByCourse()` in `src/server/repos/queries/lessons.ts` — no filter
  - Frontend components — not read at all
  
  This means when an admin unchecks "Visible to students" for a "Soon" course, students still see it. The field is a dead letter. Per the spec: *"Visibility Toggle: Hide 'Soon' content from students before ready to show."* The clarified.md says *"just locked showing teaser but preventing access"* — so visible-but-locked is the main behavior. However, the toggle exists for when admins are NOT ready to show even the teaser. That logic is completely missing.

### Major

- **[CourseCard/index.tsx:131] Button not properly disabled for "Soon" courses** — The plan specified `disabled={isLoading || isSoon}` but the implementation has `disabled={isLoading}` only. While `handleCourseSelect` does intercept the click with an early return + toast, not adding `isSoon` to the `disabled` prop means:
  1. The `disabled:pointer-events-none disabled:opacity-50` styles from the Button component won't apply
  2. The button remains clickable (just intercepted in JS) rather than being truly disabled
  3. Accessibility: screen readers won't announce the button as disabled
  
  The CSS class `cursor-not-allowed` is applied conditionally, but that's separate from the actual HTML `disabled` attribute.

- **[CourseLessonCard/index.tsx:64] "Soon" lesson still has `href="#"` on SystemLink** — When a lesson is "Soon", the `href` is set to `'#'` and click is intercepted. However, `e.preventDefault()` only prevents the default browser navigation — it doesn't prevent the `SystemLink` component from potentially triggering a route transition in the SPA router. The `#` href also causes the URL to change to `#` in the address bar if `preventDefault` fails for any reason. A safer pattern would be to conditionally render a `<div>` instead of `<SystemLink>` for locked content, or use `href={undefined}`.

### Minor

- **[ContentStatusBadge/index.tsx] `animate-pulse` may be too aggressive** — Tailwind's `animate-pulse` produces a full opacity-to-50%-and-back pulsing effect. The spec says *"subtle"* pulse animation. Consider using a custom animation with smaller opacity variation (e.g., 1 → 0.85 → 1) or use `animate-[pulse_3s_ease-in-out_infinite]` with a slower duration for subtlety.

- **[contentStatus.ts:26] `required: true` on `contentStatus` field** — Making this required forces all existing Course/Lesson documents to have this field. Since `defaultValue: 'none'` is set, new documents are fine, but existing documents in the database that predate this migration may fail validation on edit. Consider using `required: false` to be migration-safe, or add a data migration script.

- **[CourseCard/index.tsx:86] Null coalescing for `contentStatusExpiresAt`** — Uses `course.contentStatusExpiresAt ?? undefined`. The `ContentStatusBadge` props accept `string | null` already, so this conversion is unnecessary — could pass directly.

## Reuse & Quality

| Check | Status | Notes |
|-------|--------|-------|
| No duplicated access control | ✅ | `publishedAndActive` left unchanged; no new access functions created |
| No duplicated utilities | ✅ | Reuses `cn`, `toast`, `useTranslations` |
| No duplicated validation schemas | ✅ | N/A for this feature |
| Existing UI components used where possible | ✅ | Uses existing `Button`, `SafeHtml`, `ProgressCircle`; created new `ContentStatusBadge` (justified — shared across 2 components with custom logic) |
| No `any` type escapes | ✅ | No `any` in new source files |
| Functions reasonably sized (<50 lines) | ✅ | `ContentStatusBadge` ~48 lines; `CourseCard` ~90 lines (acceptable for a component) |
| No magic numbers/strings | ✅ | Constants defined in `contentStatus.ts`; translation keys used for strings |
| Error handling on all async ops | ✅ | No async ops added (toast is sync) |

## Summary

- **Issues Found**: Yes
- **Spec Satisfied**: Partial
- **Recommendation**: Fix Required

### Required Fixes (2 items)

1. **Critical: `contentStatusVisible` must be consumed somewhere** — Either:
   - (a) Add `contentStatusVisible` filtering to `queryPublishedCourses()` and `queryLessonsByChapter()` / `queryLessonsByCourse()` so "Soon" content with `visible=false` is excluded from student-facing queries, OR
   - (b) If the intent per clarified.md is that "Soon" is always visible (just locked), remove the `contentStatusVisible` field entirely and the admin condition, OR
   - (c) At minimum, add a code comment explaining the field's planned usage and a test documenting the expected behavior.

2. **Major: CourseCard button should have `disabled={isLoading || isSoon}`** — Per the plan and for proper accessibility, the `disabled` prop should include the `isSoon` check so the button is truly disabled for screen readers and pointer events.
