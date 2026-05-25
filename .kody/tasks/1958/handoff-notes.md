## Fix: Floating Open Learning Assistant button intercepting chat Send button

**Root cause**: The `FloatingAgentButton` (src/ui/web/learning-agent/FloatingAgentButton/index.tsx) has `z-[60]` and is `fixed bottom-6 right-6`. The `ChatInterface` input container (src/ui/web/chat/ChatInterface/index.tsx:619-622) had no z-index, so it shared the root stacking context where the FAB's z-60 was causing it to visually overlap and intercept pointer events on the Send button.

**Fix**: Added `z-[70]` to the input container div (the one with `data-math-controls`). Value 70 was chosen to match the existing z-index convention already used by `FloatingAskButton` (z-[70]) and `AgentChatWindow` (z-[70]) in the same codebase.

**Files changed**:
- `src/ui/web/chat/ChatInterface/index.tsx`: Added `z-[70]` to the input container className
- `tests/unit/components/chat/z-index-stacking.spec.ts`: New static-analysis test verifying z-index stacking hierarchy

**Test**: 5 tests in `z-index-stacking.spec.ts` verify: FAB has z-60, FAB is bottom-right fixed, chat input has z > 60, chat input uses z-[70], and stacking hierarchy ordering (FAB 60 < chat input 70).
