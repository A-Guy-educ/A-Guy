# Build Agent Report: Cody Pipeline Bug Fixes

## Changes

- **`src/ui/web/chat/hooks/useNotebookChat.ts`**: Wrapped `streamMessage` function in `useCallback` to fix ESLint `react-hooks/exhaustive-deps` warning. The function was causing the `injectExerciseContext` useCallback dependency array to change on every render, which with `--max-warnings=0` blocked all commits touching this file.

- **`scripts/cody/git-utils.ts`**: Improved commit message sanitization in two functions:
  - `extractCommitSubject`: Added stripping of markdown headers (`##`), bold markers (`**`), and inline code (`` ` ``) from subject lines
  - `extractCommitBody`: Added stripping of bold markers and inline code from bullet points in the commit body

- **`scripts/cody/git-utils.ts`** (BUG-15 fix): Modified `commitAndPush()` function (lines 433-448) to stage new files from safe directories (`['src', 'tests', 'scripts', 'public', 'docs', '.tasks']`) instead of only staging modified tracked files with `git add -u`. This ensures new source files created by the build agent are properly staged while preserving security (avoiding `git add -A` which could accidentally stage root-level .env files).

## Tests Written

- No tests written (this was a bug fix for pre-existing issues that blocked commits)

## Quality

- TypeScript: PASS
- Lint: PASS (ESLint warning for `streamMessage` is now resolved)

## Root Cause Analysis

The CI failure in task 260220-auto-67 was caused by two issues:

1. **ESLint warning blocking commits**: The `streamMessage` function in `useNotebookChat.ts` was a plain async arrow function used as a dependency in `injectExerciseContext`'s useCallback. ESLint correctly warned that this makes the useCallback's dependencies change on every render, defeating its purpose. With `--max-warnings=0` in the pre-commit hook, this warning blocked the commit.

2. **Commit message formatting**: The `extractCommitSubject` function wasn't stripping markdown headers, causing malformed commit messages like `fix(task): ## Description ...` instead of extracting a proper subject line.

3. **New source files not staged**: The `commitAndPush()` function used `git add -u` which only stages modified tracked files. New files created by the build agent in `src/`, `tests/`, etc. were never staged. Only `.tasks/<taskId>/` got new files staged.
