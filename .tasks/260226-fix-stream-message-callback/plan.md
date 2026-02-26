# Implementation Plan: Fix streamMessage useCallback Performance Bug

**Task ID**: 260226-fix-stream-message-callback
**Task Type**: fix_bug
**Spec Requirements**: FR-1, FR-2

---

## Rerun Context

The previous plan was a skeleton that didn't match the current code state. The code has already been partially fixed — `streamMessage` IS wrapped in `useCallback` (line 393). However, the downstream stability issue remains: `injectExerciseContext` depends on `isLoading` and `isLoadingHistory` state variables, causing it to recreate on every loading state change. This triggers the `useEffect` in `ChatInterface/index.tsx` (line 310-314) repeatedly. The plan now addresses the remaining acceptance criteria (AC #3).

---

## Analysis

### Current State
- `streamMessage` is already wrapped in `useCallback` at line 393 with deps: `[errorMessage, authRequiredMessage, guestLimitMessage, scrollToBottom, onConversationCreated]` ✅
- No ESLint `react-hooks/exhaustive-deps` warnings exist on useNotebookChat.ts ✅
- `injectExerciseContext` (line 623) depends on `isLoading` and `isLoadingHistory` — these are state variables that change frequently, causing the callback to recreate unnecessarily ❌

### Root Cause
`injectExerciseContext` uses `isLoading` and `isLoadingHistory` only as early-return guards (line 647). These state values are in the `useCallback` dependency array (lines 663-664), so the callback reference changes on every loading state transition. Since `ChatInterface/index.tsx` line 314 has `injectExerciseContext` in a `useEffect` dep array, this causes the exercise context injection to re-fire whenever loading state changes.

### Fix Strategy
Use refs to track `isLoading` and `isLoadingHistory` so they can be read inside the callback without being in the dependency array. This keeps the callback reference stable.

---

## Step 1: Stabilize `injectExerciseContext` by using refs for volatile state

**Root Cause**: `injectExerciseContext` depends on `isLoading` and `isLoadingHistory` state variables which change frequently, causing the callback to get a new reference on every loading state change. This triggers the `useEffect` in `ChatInterface/index.tsx:310-314` repeatedly.

**Files to Touch**:
- `src/ui/web/chat/hooks/useNotebookChat.ts` (MODIFIED — lines ~80-90, ~623-673)

**Changes**:

1. Add refs to mirror `isLoading` and `isLoadingHistory` state (after the useState declarations, around line 90):
   ```tsx
   const isLoadingRef = useRef(false)
   const isLoadingHistoryRef = useRef(true)
   ```

2. Keep refs in sync with state by adding `useEffect` hooks (or inline sync after the useState calls):
   ```tsx
   // Sync refs with state for stable callback access
   isLoadingRef.current = isLoading
   isLoadingHistoryRef.current = isLoadingHistory
   ```
   (This is a synchronous assignment during render — no useEffect needed. Place right after the useState declarations.)

3. Update `injectExerciseContext` (line 623-673) to use refs instead of state:
   - Change line 647 from `if (isLoading || isLoadingHistory) return` to `if (isLoadingRef.current || isLoadingHistoryRef.current) return`
   - Remove `isLoading` and `isLoadingHistory` from the dependency array (lines 663-664)

**After the fix**, the dependency array of `injectExerciseContext` should be:
```tsx
[streamMessage, acknowledgment, exerciseId, lessonId, chapterId, courseId, categoryId]
```

All of these are either stable callbacks (streamMessage via useCallback) or props that change only when the user navigates to a different exercise/lesson — not on every loading state transition.

**Reproduction Test**:
- Test location: `tests/unit/hooks/useNotebookChat.test.ts`
- Test name: `injectExerciseContext should maintain stable reference across loading state changes`
- What it tests: Renders the hook, captures `injectExerciseContext` reference, triggers a loading state change (e.g., by sending a message), then verifies that the `injectExerciseContext` reference is the SAME object (referential equality).
- Why it fails before fix: `isLoading` changes from `false → true → false` during message send, causing `injectExerciseContext` to get a new reference each time.
- Why it passes after fix: `isLoading` is accessed via ref, not in the dep array, so the callback reference stays stable.

**Test implementation sketch** (the build agent writes the actual code):
```tsx
it('injectExerciseContext should maintain stable reference across loading state changes', async () => {
  const { result } = renderHook(() => useNotebookChat(defaultProps))
  await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

  // Capture initial reference
  const initialRef = result.current.injectExerciseContext

  // Trigger a loading state change by sending a message
  act(() => {
    result.current.setInputValue('Hello')
  })
  await act(async () => {
    result.current.handleSubmit({ preventDefault: () => undefined } as React.FormEvent)
  })
  await waitFor(() => expect(result.current.isLoading).toBe(false))

  // Reference should be the same (stable callback)
  expect(result.current.injectExerciseContext).toBe(initialRef)
})
```

**Acceptance Criteria**:
- [ ] `injectExerciseContext` dependency array does NOT contain `isLoading` or `isLoadingHistory`
- [ ] `injectExerciseContext` still correctly returns early when loading (tested via ref)
- [ ] `injectExerciseContext` reference stays stable across loading state changes (referential equality test)
- [ ] ESLint passes with no new warnings (`pnpm -s lint`)
- [ ] TypeScript compiles cleanly (`pnpm -s tsc --noEmit`)
- [ ] All existing tests in `tests/unit/hooks/useNotebookChat.test.ts` continue to pass

---

## Step 2: Verify all spec acceptance criteria are met

**Files to Touch**: None (verification only)

**Verification Commands**:
```bash
# TypeScript compilation
pnpm -s tsc --noEmit

# ESLint (no exhaustive-deps warnings)
pnpm -s lint

# Run unit tests
pnpm vitest run tests/unit/hooks/useNotebookChat.test.ts
```

**Spec Acceptance Criteria Mapping**:
- [FR-1] `streamMessage` at line 393 is wrapped with `useCallback` → Already done ✅
- [FR-2] ESLint `react-hooks/exhaustive-deps` warning resolved → Already resolved, verify no regressions ✅
- [AC #3] `injectExerciseContext` no longer re-creates on every render due to `streamMessage` dependency → Fixed in Step 1 by removing volatile state from deps ✅

---

## Assumptions

1. The spec line numbers (446, 689) refer to an older version of the code. The current `streamMessage` is at line 393 and `injectExerciseContext` deps are at line 662-672.
2. No `clarified.md` or `rerun-feedback.md` exist — this is treated as a first proper plan run.
3. The synchronous ref-sync pattern (`isLoadingRef.current = isLoading` during render) is the standard React pattern for keeping refs in sync without useEffect overhead. This is safe because refs don't trigger re-renders.
4. `sendContextualHelp` and `sendVisibleHelp` being plain functions (not useCallback) is acceptable because ChatInterface uses the ref pattern for their event handlers (lines 192-202, 227-265, 274-301), avoiding stale closure issues.

---

## Risk Assessment

- **Risk**: LOW — Single file change, refs are a well-established React pattern
- **Breaking change risk**: NONE — The callback signature and behavior are identical; only reference stability improves
- **Regression risk**: LOW — Existing tests cover all hook functionality; new test explicitly verifies the fix
