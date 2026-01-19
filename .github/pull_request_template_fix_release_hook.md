# Pull Request: fix/release-hook-fix → main

## Title

`fix: Allow CI-initiated commits to main for releases`

## Description

### Problem

The release workflow was failing because the pre-commit hook blocks direct commits to the `main` branch. When semantic-release creates a release, it needs to commit the updated `CHANGELOG.md` and `package.json` files directly to `main`, but the hook was rejecting these commits with:

```
❌ ERROR: Direct commits to 'main' branch are not allowed
```

### Solution

Added CI detection to the pre-commit hook to allow commits initiated from GitHub Actions, and set `SKIP_HOOKS=1` in the release workflow.

### Changes Made

#### 1. `.husky/pre-commit` (lines 17-29)

```sh
# Prevent direct commits to protected branches (main, dev) unless CI-initiated
if [ "$branch" = "main" ] || [ "$branch" = "dev" ]; then
  # Check if this is a CI-initiated commit:
  # 1. Running in GitHub Actions (GITHUB_ACTIONS is set)
  # 2. Has SKIP_HOOKS=1 set
  if [ -n "$GITHUB_ACTIONS" ] || [ "$SKIP_HOOKS" = "1" ]; then
    echo ""
    echo "ℹ️  CI-initiated commit to '$branch' detected. Skipping branch protection check."
    echo ""
    exit 0
  fi
```

#### 2. `.github/workflows/release.yml` (line 81)

```yaml
- name: Run semantic-release
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
    SKIP_HOOKS: 1 # <-- Added this line
  run: pnpm exec semantic-release
```

### Why This Works

1. When semantic-release runs in GitHub Actions, the `GITHUB_ACTIONS` environment variable is set
2. The pre-commit hook checks for this variable and allows the commit if present
3. Alternatively, the `SKIP_HOOKS=1` environment variable explicitly skips the hook

### Testing

- Trigger a release workflow to verify the fix works
- The release should complete without the pre-commit hook blocking the commit

### Breaking Changes

None. This is a non-breaking fix that only affects CI-initiated commits.

### Related

- Previous release failures shown in commit history: d11cddf, 7fe04a8, 3150301
