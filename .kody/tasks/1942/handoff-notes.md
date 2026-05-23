# Task 1942: QuestionCard RTL section labels alignment fix

## What was done

Fixed the RTL alignment issue in QuestionCard component where section labels (א, ב, ג) appeared on the left physical side instead of the right in Hebrew.

**File changed:** `src/ui/web/exerciserenderer/components/QuestionCard/index.tsx`

**Change:** In the RTL branch of the questionLabel div, removed `flex-row-reverse` and changed `justify-end text-right` to just `justify-start`. Since `justify-start` in RTL already aligns to the logical right edge, the extra `justify-end text-right flex-row-reverse` was causing the circle to appear on the left physical side.

**Before (line 77-79):**
```tsx
dir === 'rtl'
  ? 'justify-end text-right flex-row-reverse gap-content-gap-xs'
  : 'justify-start text-left gap-content-gap-xs',
```

**After:**
```tsx
dir === 'rtl'
  ? 'justify-start gap-content-gap-xs'
  : 'justify-start text-left gap-content-gap-xs',
```

## Followup

ExerciseWorksheet has the same pattern at line 303 and may need the same fix applied for consistency.
