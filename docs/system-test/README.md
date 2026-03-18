# Cody Pipeline System Test - Overview

## What This Test Does

Runs the full Cody pipeline against a real GitHub issue to test all stages:
- taskify → architect → plan-gap → build → commit → verify → test → docs → PR

## Test Configuration

**Location**: `scripts/system-test/scenarios/02-full-high-complexity.ts`

**Key inputs**:
- `--complexity 65` - Forces all pipeline stages to run
- `--use_test_config=true` - Uses cheap models (Groq) instead of expensive ones
- Uses `opencode.test.json` which configures `groq/llama-3.3-70b-versatile` for all agents

## How to Trigger

```bash
# Using workflow dispatch
gh workflow run cody.yml \
  -f task_id=260318-systest-$(date +%m%d%H%M) \
  -f issue_number=886 \
  -f complexity=65 \
  -f use_test_config=true \
  --repo A-Guy-educ/A-Guy
```

Or manually via GitHub UI:
1. Go to Actions → cody workflow
2. Click "Run workflow"
3. Fill in: task_id, issue_number, complexity=65, use_test_config=true

## How to Monitor

### Check workflow run status
```bash
gh run list --repo A-Guy-educ/A-Guy --workflow cody.yml --limit 3
gh run view <run_id> --repo A-Guy-educ/A-Guy
```

### Check issue labels (pipeline progress)
```bash
gh issue view 886 --repo A-Guy-educ/A-Guy --json labels
```

Labels indicate stage:
- `cody:planning` - taskify stage
- `cody:building` - build stage  
- `cody:review` - verify/test stage
- `cody:done` - completed successfully
- `cody:failed` - failed

### Check for PR creation
```bash
gh pr list --repo A-Guy-educ/A-Guy --search "886"
```

## Common Issues & Fixes

### 1. Groq model fails with "Error: undefined"
**Cause**: GROQ_API_KEY not set in workflow secrets
**Fix**: Add `GROQ_API_KEY` to workflow secrets and inject in cody.yml:
```yaml
- name: Set LLM keys
  run: |
    echo "GROQ_API_KEY=${{ secrets.GROQ_API_KEY }}" >> $GITHUB_ENV
```

### 2. Git push fails with "403 Write access not granted"
**Cause**: GitHub App token doesn't have write permissions
**Fix**: 
1. Ensure workflow has `permissions: contents: write`
2. Add explicit permissions to app token:
```yaml
- name: Generate GitHub App token
  uses: actions/create-github-app-token@v1
  with:
    app-id: 3116827
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    permission-contents: write
    permission-pull-requests: write
```
3. Configure git to use app token:
```yaml
- name: Configure git identity
  run: |
    git config --global url."https://x-access-token:${{ steps.app-token.outputs.token }}@github.com/".insteadOf "https://github.com/"
```

### 3. Label creation fails with "not found"
**Cause**: Label doesn't exist in repository
**Fix**: Create labels in repo settings or update code to create labels dynamically

## Test Artifacts

Artifacts are uploaded to each run:
- `cody-<task_id>-<run_id>` - Contains task files, logs, status

Download with:
```bash
gh run download <run_id> --repo A-Guy-educ/A-Guy
```

## Cleanup

After test completes (success or failure), clean up:
```bash
# Delete test issues
gh issue list --repo A-Guy-educ/A-Guy --search "SYSTEM-TEST" --state all

# Delete test PRs  
gh pr list --repo A-Guy-educ/A-Guy --search "SYSTEM-TEST"
```

## Files Involved

- `.github/workflows/cody.yml` - Main workflow
- `scripts/system-test/scenarios/02-full-high-complexity.ts` - Test scenario
- `scripts/system-test/lib/cleanup.ts` - Cleanup logic
- `opencode.test.json` - Cheap model config
