# Build Agent Report: 260226-fix-stream-message-callback

## Changes

- **src/ui/web/chat/hooks/useNotebookChat.ts**: Added refs (`isLoadingRef`, `isLoadingHistoryRef`) to mirror volatile state for stable callback access, updated `injectExerciseContext` to use refs instead of state variables in its dependency array to prevent unnecessary re-renders

## Tests Written

- **tests/unit/hooks/useNotebookChat.test.ts**: Added test "injectExerciseContext should maintain stable reference across loading state changes" to verify that `injectExerciseContext` maintains referential equality across loading state transitions

## Quality

- TypeScript: PASS
- Lint: PASS (no new warnings in modified file)
- Unit Tests: PASS (all 12 tests in useNotebookChat.test.ts pass, including the new stability test)

## Acceptance Criteria

- [x] `streamMessage` at line 393 was already wrapped with `useCallback` (pre-existing)
- [x] ESLint `react-hooks/exhaustive-deps` warning on line 689 was already resolved (pre-existing)
- [x] `injectExerciseContext` no longer re-creates on every render due to `isLoading`/`isLoadingHistory` dependency (fixed via refs pattern)

## Technical Details

The fix implements the refs pattern for stable callback access:
1. Added `isLoadingRef` and `isLoadingHistoryRef` refs initialized with state values
2. Sync refs with state during render (synchronous assignment: `isLoadingRef.current = isLoading`)
3. Updated `injectExerciseContext` to check `isLoadingRef.current` and `isLoadingHistoryRef.current` instead of direct state values
4. Removed `isLoading` and `isLoadingHistory` from the useCallback dependency array

This ensures `injectExerciseContext` maintains a stable reference across loading state changes, preventing unnecessary re-renders in dependent components like `ChatInterface/index.tsx`.
