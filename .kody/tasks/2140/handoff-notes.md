# Issue #2140: Mobile Chat FAB Toggle - Implementation Notes

## What was done

1. **Created MobileChatToggle component** (`src/ui/web/chat/MobileChatToggle/index.tsx`)
   - FAB button at bottom-left (start-6) using Tailwind logical properties for RTL support
   - Expanded state: fixed overlay with backdrop dim (bg-black/5), bottom sheet with pill input
   - Listens for `focus-chat-input` event to auto-open (dispatched by ChatInterface on incorrect answer)
   - Collapse via chevron button or Escape key

2. **Modified ChatInterface** (`src/ui/web/chat/ChatInterface/index.tsx`)
   - Added `autoFocus?: number` and `fabOpen?: boolean` props
   - Added MobileChatToggle rendering inside ChatInterface on mobile in PDF mode
   - Input container hidden when `fabOpen=true` (FAB provides the input)
   - Removed the `onChatInteraction?.()` call from focus-chat-input handler (FAB handles its own opening)

3. **Modified SplitPaneLayout** (`src/ui/web/components/split-pane-layout.tsx`)
   - Added `focusCount` state and `mobile-chat-open` event listener
   - Passes `autoFocus={focusCount}` and `fabOpen={viewMode === 'PDF' && !chatExpandedInPdf}` to ChatInterface
   - Desktop behavior unchanged

4. **Added translations**: `closeChat` in en.json and he.json (admin.chat namespace)

5. **Created E2E tests** (`tests/e2e/mobile-chat-fab.e2e.spec.ts`)

## Key architectural decision

MobileChatToggle is rendered **inside** ChatInterface, not in SplitPaneLayout. This is necessary because MobileChatToggle needs access to ChatInterface's internal state and callbacks (handleSubmit, inputValue, setInputValue, etc.). SplitPaneLayout only passes through props via cloneElement.

## Potential issue (see followups)

When FAB closes, onCollapse only calls setIsChatInputFocused(false). It doesn't reset SplitPaneLayout's chatExpandedInPdf state, which could leave the chat panel expanded even when FAB is closed. The FAB button reappears (because isInternalOpen becomes false), but the underlying SplitPaneLayout might still think chat is expanded.
