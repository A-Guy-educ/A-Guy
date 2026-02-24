# Build Agent Report: cody-pr-title-bug

## Changes

### 1. `scripts/cody/cody-utils.ts`
- Added `getIssue()` function that fetches both body and title in a single `gh` API call (was making 2 calls before)
- Kept `getIssueBody()` and `getIssueTitle()` for backward compatibility

### 2. `scripts/cody/cody.ts`
- Updated to use the new merged `getIssue()` function
- Fixed newline formatting when generating task.md from issue body:
  - Before: `# Task\n\n## Issue Title\n\nTitle\n\n\nDescription` (extra blank line)
  - After: `# Task\n\n## Issue Title\n\nTitle\n\nDescription` (correct)

### 3. `scripts/cody/scripted-stages.ts`
- **More forgiving regex**: Changed from `\n\n` to `\n+` for Issue Title extraction to handle variable whitespace
- **Strip severity tags**: Removes prefixes like `[MEDIUM]`, `[HIGH]`, `[BUG]` from issue titles before using as PR title
- **Improved heading detection**: Now tracks whether a line was originally a markdown heading before stripping, and excludes only those that match common heading words

## Root Cause

The original `buildPrTitle()` function was extracting the first non-empty line from `task.md` after removing the `# Task` header. When the next line was `## Description`, the regex stripped the `##` prefix, leaving just "Description" as the PR title.

## How It Works Now

1. When creating `task.md` from a GitHub issue, we fetch both the issue title and body in a single API call
2. The issue title is stored as `## Issue Title` section in task.md
3. When building PR title:
   - Extract the issue title first (highest priority)
   - Strip severity tags like `[MEDIUM]`, `[BUG]` from it
   - Fall back to first content line if no issue title
   - Finally fall back to commit messages

## Example

**Issue title**: `[MEDIUM] Bug: VideoMedia event listener memory leak`

**Before**: `fix: description` (when issue body started with `## Description`)

**After**: `fix: bug: videomedia event listener memory leak` (uses actual issue title, stripped of severity prefix)

## Quality

- TypeScript: PASS (no errors)
