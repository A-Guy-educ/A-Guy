# Issue #1786: Upgrade floating chat button with expandable input panel

## Status: COMPLETE

The implementation was already in place on this branch. No changes were needed.

## What Exists

**FloatingAskButton** (`src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/FloatingAskButton/index.tsx`):
- Floating button at `fixed bottom-6 left-6` (24px from edges) with `MessageSquare` icon
- `md:hidden` class restricts to mobile only
- Expandable panel with framer-motion animation (opacity + scale + x translate)
- RTL text input with Hebrew placeholder "שלח הודעה..." from `homepage.ask` namespace
- Actions bar: math (f italic), media (+), send button
- Click-outside handler closes panel
- Dispatches `quick-chat-submit` event on send

**ChatInterface** (`src/ui/web/chat/ChatInterface/index.tsx`):
- Already has `quick-chat-submit` event listener (lines 246-259)
- Sets input value and calls `formRef.current?.requestSubmit()`

## Verification
- `pnpm typecheck` passes
- `pnpm lint` passes (warnings only)
- Unit tests pass: `tests/unit/components/FloatingAskButton-expandable.test.tsx` (10 tests)
- Full quality gates via `verify` tool pass
