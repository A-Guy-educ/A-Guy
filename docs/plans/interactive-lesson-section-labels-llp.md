# LLP: Interactive Lesson Section Labels

## Overview
Add a locale-aware section label badge to the interactive lesson exercises pager.

Locked decisions:
- Labels are limited to `A-J` (English) and `א-י` (Hebrew) only.
- If a label cannot be derived (out of range / unknown locale), the badge is hidden (no fallback glyph/text).
- The existing numeric line (`Exercise X of Y`) remains unchanged.

## Files to Create/Modify

### 1. New File: `src/infra/utils/getSectionLabel.ts`

**Purpose**: Centralize the section-label mapping and ensure the UI can safely hide the badge when the label is not available.

```ts
/**
 * @fileType utility
 * @domain courses
 * @pattern i18n
 * @ai-summary Maps a 0-based index to A-J or א-י section labels.
 */
const EN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const
const HE_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י'] as const

export function getSectionLabel(locale: string, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= 10) return ''

  if (locale === 'en') return EN_LABELS[index]
  if (locale === 'he') return HE_LABELS[index]

  return ''
}
```

### 2. New File: `tests/unit/infra/utils/getSectionLabel.test.ts`

**Purpose**: Unit tests for mapping behavior (including locked decisions: A-J / א-י only, and hiding badge via `''` on fallback).

```ts
import { describe, expect, it } from 'vitest'

import { getSectionLabel } from '@/infra/utils/getSectionLabel'

describe('getSectionLabel', () => {
  it('returns A-J for en locale (0-based index)', () => {
    expect(getSectionLabel('en', 0)).toBe('A')
    expect(getSectionLabel('en', 1)).toBe('B')
    expect(getSectionLabel('en', 9)).toBe('J')
  })

  it('returns א-י for he locale (0-based index)', () => {
    expect(getSectionLabel('he', 0)).toBe('א')
    expect(getSectionLabel('he', 1)).toBe('ב')
    expect(getSectionLabel('he', 9)).toBe('י')
  })

  it("returns '' for out-of-range indexes (A-J / א-י only)", () => {
    expect(getSectionLabel('en', -1)).toBe('')
    expect(getSectionLabel('en', 10)).toBe('')
    expect(getSectionLabel('he', 999)).toBe('')
  })

  it("returns '' for non-integer indexes (hide badge on fallback)", () => {
    expect(getSectionLabel('en', 1.5)).toBe('')
    expect(getSectionLabel('en', Number.NaN)).toBe('')
  })

  it("returns '' for unknown locales (hide badge on fallback)", () => {
    expect(getSectionLabel('fr', 0)).toBe('')
  })
})
```

### 3. Modified File: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx`

**Purpose**: Render the section label badge (when available) in the exercise header without changing the numeric line.

**Import changes**:
- Update `useTranslations` import to also import `useLocale` from `src/ui/web/providers/I18n/index.tsx`.
- Add `getSectionLabel` import from `src/infra/utils/getSectionLabel.ts`.

```ts
// BEFORE
import { useTranslations } from '@/ui/web/providers/I18n'

// AFTER
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { getSectionLabel } from '@/infra/utils/getSectionLabel'
```

Add these locals near the other hooks:

```ts
const locale = useLocale()
const label =
  pageState.type === 'exercise' && pageState.exerciseIndex !== undefined
    ? getSectionLabel(locale, pageState.exerciseIndex)
    : ''
```

Header area change (exercise page):

Current code:

```tsx
<div className="flex items-center gap-3 mb-3">
  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
    <Layers className="w-5 h-5 text-primary" />
  </div>
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
      {t('exercise')} {pageState.exerciseIndex + 1} {t('of')} {exercises.length}
    </p>
    <h2 className="text-xl font-medium text-foreground">
      {exercises[pageState.exerciseIndex]?.title}
    </h2>
  </div>
</div>
```

Replacement:

```tsx
<div className="flex items-center gap-3 mb-3">
  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
    <Layers className="w-5 h-5 text-primary" />
  </div>
  <div className="min-w-0">
    <div className="flex items-center gap-2">
      {label !== '' && (
        <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
          {label}
        </span>
      )}
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
        {t('exercise')} {pageState.exerciseIndex + 1} {t('of')} {exercises.length}
      </p>
    </div>
    <h2 className="text-xl font-medium text-foreground truncate">
      {exercises[pageState.exerciseIndex]?.title}
    </h2>
  </div>
</div>
```

Notes:
- The numeric line remains unchanged (same translation keys + same `Exercise X of Y` structure).
- The badge is hidden when `label === ''` (fallback behavior).

### 4. Referenced File: `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx`

**Purpose**: This is the interactive entry that renders `ExercisesPager` when the lesson has exercises but no attached document.

No functional changes required for section labels if `ExercisesPager` reads locale via `useLocale()`.

### 5. Referenced File: `src/ui/web/providers/I18n/index.tsx`

**Purpose**: Source of `useLocale()` (pager reads locale from here). No changes required if the helper accepts `string`.

### 6. Referenced File: `src/i18n/config.ts`

**Purpose**: Source of truth for supported locales (`en`, `he`) and the `Locale` type.

## Execution Order

1. Create `src/infra/utils/getSectionLabel.ts`.
2. Create `tests/unit/infra/utils/getSectionLabel.test.ts`.
3. Update `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` imports + header area rendering.
4. Run unit tests and TypeScript checks.

## Verification Checklist

- [ ] Unit: `pnpm vitest run tests/unit/infra/utils/getSectionLabel.test.ts` passes.
- [ ] Typecheck: `pnpm tsc --noEmit` passes.
- [ ] UI (English): interactive lesson shows badge `A` for the first exercise, `J` for the 10th; no badge for 11th+.
- [ ] UI (Hebrew): interactive lesson shows badge `א` for the first exercise, `י` for the 10th; no badge for 11th+.
- [ ] UI: numeric line remains exactly `Exercise X of Y` (existing translations/format unchanged).
- [ ] UI: when badge is hidden (fallback), layout still looks correct (no empty pill, no placeholder).

## Test Cases Summary

| Case | Input | Expected |
|------|-------|----------|
| English first | `index=0, locale=en` | `A` |
| English tenth | `index=9, locale=en` | `J` |
| Hebrew first | `index=0, locale=he` | `א` |
| Hebrew tenth | `index=9, locale=he` | `י` |
| Out of range | `index=10` | `''` (hide badge) |
| Negative | `index=-1` | `''` (hide badge) |
| Unknown locale | `locale=fr` | `''` (hide badge) |

## TypeScript Considerations

- `src/i18n/config.ts` defines `Locale` as `'en' | 'he'`; the helper accepts `locale: string` to avoid importing app i18n types.
- UI code should treat `''` as “no label” and avoid rendering the badge.
- Keep all UI changes inside `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` to avoid coupling with server components.

## Non-Goals

- No changes to exercise ordering logic or database schema.
- No new locales or alternative label systems (no `K+`, no numbers, no roman numerals).
- No translation key changes; the existing numeric line remains as-is.
- No redesign of the pager beyond the small optional badge.
