# Plan: Publish dev → production (233 commits)

**Task ID**: 260316-auto-105
**Task Type**: ops
**Risk Level**: high (production deployment)

## Rerun Context

Previous run failed because the plan.md output file was never written. This rerun produces the required plan and context files. The rerun-feedback.md contained no specific code issues — just a `/cody rerun` request.

## Research Findings

- ✅ `.github/workflows/merge-dev-to-main.yml` — exists, handles the automated PR creation from `dev` → `main`
- ✅ `.github/workflows/ci.yml` — exists, runs CI checks on PRs
- ✅ `.tasks/260316-auto-105/task.md` — describes the publish request: 233 commits from `dev` to `main`
- ✅ `.tasks/260316-auto-105/task.json` — classified as `ops` task with complexity 30

**Workflow observed**: The `merge-dev-to-main.yml` workflow is triggered when the "publish" label is added to an issue. It:
1. Checks if `dev` is ahead of `main`
2. Checks for an existing open publish PR
3. Creates a new PR from `dev` → `main` if none exists
4. Comments on the issue with the PR link
5. Closes the issue if nothing to publish

**Integration points**: The GitHub Action handles everything automatically. The Cody pipeline does NOT need to create branches, write code, or modify files.

## Reuse Inventory

- **Reuse**: `.github/workflows/merge-dev-to-main.yml` — the existing GitHub Action handles the entire merge workflow
- **Reuse**: `.github/workflows/ci.yml` — CI runs automatically on the created PR
- **No new utilities needed** — this is a pure ops task handled by existing infrastructure

## Plan

### Step 1: Verify GitHub Action Creates the PR (Automated)

**What happens**: The `merge-dev-to-main.yml` workflow is triggered by the "publish" label on issue #853. The workflow:
1. Checks out the repository with full history
2. Counts commits `dev` is ahead of `main` (expected: 233)
3. Checks if an open publish PR already exists
4. If no existing PR, creates one via `gh pr create --base main --head dev`
5. Comments on issue #853 with the PR link

**Files involved**:
- `.github/workflows/merge-dev-to-main.yml` (EXISTING — no modification)

**Verification**:
- Check GitHub issue #853 for a comment with the PR link
- Verify PR exists: `gh pr list --base main --head dev --state open`

**Acceptance Criteria**:
- [ ] PR from `dev` → `main` exists on GitHub
- [ ] PR title matches pattern "Publish dev → production (N commits)"
- [ ] PR has the "publish" label
- [ ] Issue #853 has a comment with the PR link

### Step 2: CI Passes on the PR (Automated)

**What happens**: Once the PR is created, the CI workflow automatically runs against it. This validates:
- TypeScript type checking (`pnpm tsc --noEmit`)
- Linting (`pnpm lint`)
- Format checking (`pnpm format`)
- Integration tests (`pnpm test:int`)
- Build success (`pnpm build`)

**Files involved**:
- `.github/workflows/ci.yml` (EXISTING — no modification)

**Verification**:
- Check PR status checks: `gh pr checks <PR_NUMBER>`
- All required checks must pass (green)

**Acceptance Criteria**:
- [ ] All CI status checks pass on the PR
- [ ] No merge conflicts between `dev` and `main`

### Step 3: Merge the PR (Manual — User Action)

**What happens**: Once CI passes, the user merges the PR via the Cody dashboard Merge button or the GitHub merge button. This deploys `dev` → `main` (production).

**Verification**:
- Confirm merge: `gh pr view <PR_NUMBER> --json state`
- Confirm issue closure: `gh issue view 853 --json state`

**Acceptance Criteria**:
- [ ] PR is merged into `main`
- [ ] Issue #853 is closed (auto-closed by "Closes #853" in PR body)
- [ ] `main` branch contains all 233 commits from `dev`

## No Code Changes Required

This is a pure ops/deployment task. The existing GitHub Actions infrastructure handles the entire workflow:
1. **`merge-dev-to-main.yml`** creates the PR automatically when the "publish" label is applied
2. **`ci.yml`** validates the PR automatically
3. The user merges manually once CI passes

**The Cody pipeline build agent should NOT**:
- Create any branches
- Modify any source files
- Create any commits
- Create any PRs (the GitHub Action does this)

## Test Gate

Since this is an ops task with no code changes, the test gate is:
- Verify the PR from `dev` → `main` was created by the GitHub Action
- Verify CI passes on that PR
- The build agent should simply confirm the workflow is running and report back

## Assumptions

1. The "publish" label has been applied to issue #853, triggering the `merge-dev-to-main.yml` workflow
2. The GitHub Action has the necessary permissions (`GH_PAT` secret) to create PRs
3. There are no merge conflicts between `dev` and `main`
4. CI will pass since `dev` branch has been continuously tested
