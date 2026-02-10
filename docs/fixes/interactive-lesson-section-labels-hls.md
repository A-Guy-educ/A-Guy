# Interactive Lesson Section Labels (HLS)

## Goal
Add an alphabetic section label badge for interactive lessons (A-J for English, א-י for Hebrew) so users can quickly reference sections while paging through exercises.

## Scope
- UI-only.
- Interactive-only means the `!hasContent` branch in `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`.
- The PDF/content flow uses `ExerciseWorkspace` and is untouched.
- No schema changes.

## Project Locations
- Interactive entry: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`
- Pager UI: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`
- i18n hook/provider: `src/ui/web/providers/I18n/index.tsx`
- Locale + RTL configuration: `src/i18n/config.ts`

## Helper
Create a small helper for computing the section label:

- File: `src/infra/utils/getSectionLabel.ts`
- Signature:

```ts
export function getSectionLabel(locale: string, index: number): string
```

- Inputs:
  - `locale`: expected `'en' | 'he'` from `src/i18n/config.ts` (but accept `string` and validate)
  - `index`: 0-based section index
- Output:
  - `'A'..'J'` when locale is English and `0 <= index < 10`
  - `'א'..'י'` when locale is Hebrew and `0 <= index < 10`
- Fallback behavior:
  - Return `''` when `index >= 10`, `index < 0`, `index` is not an integer, or `locale` is unsupported.

Implementation sketch:

```ts
const EN = ['A','B','C','D','E','F','G','H','I','J']
const HE = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י']

export function getSectionLabel(locale: string, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= 10) return ''
  if (locale === 'en') return EN[index] ?? ''
  if (locale === 'he') return HE[index] ?? ''
  return ''
}
```

## UI Integration
Integrate only in the interactive pager:

- In `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`, derive the current locale using the existing i18n hook/provider from `src/ui/web/providers/I18n/index.tsx`.
- Compute `label = getSectionLabel(locale, index)` where `index` matches the currently displayed section/exercise group index (0-based).
- Render a small badge next to the existing numeric line/indicator (do not replace the numeric value).
- Hide the badge when `label === ''`.

Notes:
- Keep styling consistent with the existing pager UI (same typography scale; badge is additive and unobtrusive).
- You can use the existing badge component at `src/ui/web/components/badge.tsx`.
- RTL behavior should naturally follow existing locale/RTL config in `src/i18n/config.ts` (no new RTL logic in the helper).

## Tests
Add a focused unit test for the helper:

- Test file: `tests/unit/infra/utils/getSectionLabel.test.ts`
- Framework: Vitest
- Coverage:
  - English mapping for indices `0..9`
  - Hebrew mapping for indices `0..9`
  - Fallback `''` for `index >= 10`
  - Fallback `''` for unsupported locale (e.g. `'fr'`)
  - Fallback `''` for invalid indices (negative, non-integer)

## Out of Scope
- Changes to `ExerciseWorkspace` or PDF/content rendering.
- Any Payload collection/schema updates.
- Any new translation keys (labels are computed, not translated strings).
