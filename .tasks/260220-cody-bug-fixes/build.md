# Build Agent Report: Cody Pipeline Bug Fixes

## Changes

- **`src/ui/web/chat/hooks/useNotebookChat.ts`**: Wrapped `streamMessage` function in `useCallback` to fix ESLint `react-hooks/exhaustive-deps` warning. The function was causing the `injectExerciseContext` useCallback dependency array to change on every render, which with `--max-warnings=0` blocked all commits touching this file.

- **`scripts/cody/git-utils.ts`**: Improved commit message sanitization in two functions:
  - `extractCommitSubject`: Added stripping of markdown headers (`##`), bold markers (`**`), and inline code (`` ` ``) from subject lines
  - `extractCommitBody`: Added stripping of bold markers and inline code from bullet points in the commit body

## Tests Written

- No tests written (this was a bug fix for pre-existing issues that blocked commits)

## Quality

- TypeScript: PASS
- Lint: PASS (ESLint warning for `streamMessage` is now resolved)

## Root Cause Analysis

The CI failure in task 260220-auto-67 was caused by two issues:

1. **ESLint warning blocking commits**: The `streamMessage` function in `useNotebookChat.ts` was a plain async arrow function used as a dependency in `injectExerciseContext`'s useCallback. ESLint correctly warned that this makes the useCallback's dependencies change on every render, defeating its purpose. With `--max-warnings=0` in the pre-commit hook, this warning blocked the commit.

2. **Commit message formatting**: The `extractCommitSubject` function wasn't stripping markdown headers, causing malformed commit messages like `fix(task): ## Description ...` instead of extracting a proper subject line.
