# Task 2192 - Mobile Chat FAB Button

## What was done

Operator feedback from PR #2193 review required 4 changes:

1. **Breakpoint mismatch** (`md:hidden` → `lg:hidden`): Already correct in current code — `lg:hidden` on both FAB button and panel matches SplitPaneLayout's 1024px boundary.

2. **Position for English** (`isRTL` branch removal): Already correct — plain `left-6 bottom-6` used regardless of locale.

3. **FloatingAskButton removal**: DELETED — the `FloatingAskButton` component and test removed. MobileChatFAB replaces this functionality.

4. **Icon**: Already correct — `MessageCircle` (not `MessageSquare`) used.

Additionally ran `pnpm generate:types` to fix stale types drift.

## Verification

- `pnpm ci:local` passes (typecheck, lint, tests)
- `pnpm generate:types` completed successfully
- All 4 operator feedback items addressed

## Files modified this session

- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton/index.tsx` — DELETED
- `tests/unit/components/FloatingAskButton.test.tsx` — DELETED
- `src/payload-types.ts` — regenerated

## Prior work (PR #2193)

The initial implementation (already merged to this branch) added:
- `src/ui/web/chat/MobileChatFAB/index.tsx` — FAB + bottom panel
- `src/ui/web/components/split-pane-layout.tsx` — mounts MobileChatFAB
- `src/ui/web/chat/ChatInterface/index.tsx` — `fabOpen` prop hides input when FAB panel open
- `src/i18n/en.json` + `src/i18n/he.json` — `openChat`, `closeChat`, `chatPanelTitle` keys
- `tests/unit/components/MobileChatFAB.test.tsx` — regression tests