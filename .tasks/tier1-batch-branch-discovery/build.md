# Build Agent Report: GitHub API Rate Limit Optimization - Tier 1

## Changes

### 1. Added batch branch discovery function (`src/ui/cody/github-client.ts`)

Created new function `findBranchesByIssueNumbers(issueNumbers: (string | number)[]): Promise<Map<number, string>>` that:

- Makes only 5 `git.listMatchingRefs` GitHub API calls total (one per branch prefix: feat, fix, refactor, docs, chore) regardless of how many issue numbers are passed
- Caches the full branch list per prefix for 10 minutes (`branches:prefix:{prefix}` cache key)
- Also caches individual branch lookups (`branch:issue:{number}`) for future single-issue lookups
- Returns a Map of issue number → branch name for all requested issues in a single call

**Before**: 5 GitHub API calls per active task × N active tasks = up to 5N calls per poll
**After**: 5 GitHub API calls total per poll (cached for 10 min)

### 2. Updated tasks API route (`src/app/api/cody/tasks/route.ts`)

Refactored to use batch branch discovery:

- **Before**: Called `findBranchByIssueNumber()` inside the task mapping loop, resulting in N sequential or parallel branch lookups
- **After**: 
  1. First pass: Identifies all issue numbers that need branch lookup
  2. Single batch call: `findBranchesByIssueNumbers(activeIssueNumbers)`
  3. Second pass: Uses pre-fetched branch map when building tasks

## Impact

With 5 active tasks:
- **Before**: Up to 25 GitHub API calls per poll (when cache cold)
- **After**: 5 GitHub API calls per poll (when cache cold)

**Estimated reduction**: ~80% fewer branch-related GitHub API calls per tasks poll.

## Tests Written

- No new tests written (this is an optimization/refactoring, no behavior change)

## Deviations

None — plan followed exactly.

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (4025 tests)

## Notes

- The batch function also caches individual branch lookups, so subsequent single-issue lookups (via `findBranchByIssueNumber` from other routes like task detail) will hit cache
- The prefix branch lists are cached for 10 minutes, so subsequent polls with different active tasks will be nearly free (only cache miss checks)
