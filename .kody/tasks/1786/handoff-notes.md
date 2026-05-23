## Issue #1786: Upgrade floating chat button with expandable input panel

### What was done

Replaced the simple FloatingAskButton with an expandable panel component:

**Component** (`FloatingAskButton/index.tsx`):
- `AnimatePresence` + `motion.div` animates between collapsed button and expanded panel
- Panel appears at `bottom-6 left-6` (24px from edges), same as the collapsed button
- Expanded panel: `bg-card border-border rounded-full shadow-elevation-3`, min-w-320px max-w-400px
- Left side: math formula button (small rounded square with italic "f") + media upload button (round with "+")
- Right side: text input (RTL-aware, auto-focused on open, placeholder "Ask a question...")
- Far right: send button (round, colored, primary)
- `mousedown` listener on document closes panel when clicking outside
- `Enter` key submits, `Escape` key closes panel
- Sends `quick-chat-submit` event with message on send
- Dispatches `focus-chat-input` for backward compatibility

**Tests**:
- Updated `FloatingAskButton.test.tsx` to reflect new 24px offset positioning and removed safe-area test
- Added `FloatingAskButton-expandable.test.tsx` with 10 tests covering: render, expand on click, math/upload/send buttons, click-outside close, auto-focus, positioning, z-index, and event dispatch

### Known gaps (see followups.json)

1. Formula button toggles state but doesn't render the FormulaComposer popup (medium priority)
