# Fix streamMessage useCallback Performance Bug

## Overview
Fix a React performance bug in `useNotebookChat` where the `streamMessage` function is not wrapped in `useCallback`, causing unnecessary re-renders.

## Requirements

- FR-1: Wrap the `streamMessage` function (line 446) in `useCallback` to prevent recreation on every render
- FR-2: Ensure the callback dependencies are stable to avoid triggering re-renders in dependent hooks

## Acceptance Criteria

- [ ] `streamMessage` at line 446 is wrapped with `useCallback`
- [ ] ESLint `react-hooks/exhaustive-deps` warning on line 689 is resolved
- [ ] `injectExerciseContext` no longer re-creates on every render due to `streamMessage` dependency
