# Issue #2468: FAB is not keyboard accessible

## What was done

Added `tabIndex={0}` to the FAB `<button>` element in `src/ui/web/chat/MobileChatFAB/index.tsx` (line 85). Also added a regression test in `tests/unit/components/MobileChatFAB.test.tsx` asserting `expect(fabButton).toHaveAttribute('tabindex', '0')`.

## Root cause

The FAB button lacked an explicit `tabindex` attribute. While native `<button>` elements are naturally focusable in browsers, some screen-reader/browser configurations skip buttons without an explicit `tabindex` during keyboard navigation.

## Files changed

- `src/ui/web/chat/MobileChatFAB/index.tsx` — added `tabIndex={0}` to the button
- `tests/unit/components/MobileChatFAB.test.tsx` — added test: "should be keyboard accessible with tabIndex attribute"

## Verification

All 10 unit tests in `MobileChatFAB.test.tsx` pass. Quality gates (typecheck, lint, unit tests) are green.
