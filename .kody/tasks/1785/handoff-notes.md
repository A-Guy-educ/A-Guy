# Task 1785: Remove bottom chat input bar from lesson page on mobile

## What was done
Fixed the bug in `src/ui/web/components/split-pane-layout.tsx` where a persistent bottom chat input bar appeared on mobile in PDF mode when the chat was collapsed.

## Root cause
The `displayMode` ternary at lines 226-229 did not check `isDesktop` before setting `input-only`. On mobile (`!isDesktop`), even when `viewMode === 'PDF'` and `chatExpandedInPdf === false`, it still passed `'input-only'` to the chat component, causing the bottom bar to appear.

## Fix
Added `|| !isDesktop` to the displayMode ternary condition:
```typescript
displayMode:
  viewMode === 'CHAT' || (viewMode === 'PDF' && chatExpandedInPdf) || !isDesktop
    ? 'full'
    : ('input-only' as const),
```

On mobile (`!isDesktop`), the condition now short-circuits to `'full'` for all cases, so `displayMode` is always `'full'` on mobile. The `FloatingAskButton` continues to handle opening the chat on click.

## Files changed
- `src/ui/web/components/split-pane-layout.tsx` — added `|| !isDesktop` to the displayMode ternary
- `tests/unit/components/split-pane-layout-mobile-chat.test.tsx` — new regression test

## Verification
- Unit test passes (verified `!isDesktop` is in the displayMode condition)
- All quality gates pass (typecheck, lint, unit tests)
