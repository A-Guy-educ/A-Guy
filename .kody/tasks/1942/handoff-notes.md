# Task 1942: QuestionCard RTL section labels alignment fix

## What was done

Verified that the RTL alignment fix in QuestionCard was already applied in a previous session. Added a regression test to prevent future regressions.

**Files touched:**
- `src/ui/web/exerciserenderer/components/QuestionCard/index.tsx` - already fixed (no changes made)
- `tests/int/exerciserenderer/QuestionCardRTL.int.spec.tsx` - new regression test added

**Existing fix (already in place at line 77-79):**
```tsx
dir === 'rtl'
  ? 'justify-start gap-content-gap-xs'
  : 'justify-start text-left gap-content-gap-xs',
```

The RTL branch no longer has `flex-row-reverse` which was causing the circle to appear on the left physical side instead of the right in Hebrew.

## Followup needed

ExerciseWorksheet (`src/ui/web/exerciserenderer/ExerciseWorksheet/index.tsx` line 303) has the same pattern and should be fixed with the same change.