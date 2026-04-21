## Release Publisher Watch Agent

This agent automates the full release lifecycle: creates a tracking issue, runs kody-engine release, merges to dev, finalizes (E2E → tag → release → publish → notify), creates promotion PR, and merges to main.

---

## Step 1: Check for existing tracking issue and retry state

Before doing anything, check if a release is already in progress or failed:

```bash
# List all open release tracking issues
gh issue list --label "kody:watch:release" --state open --limit 10
```

For each open issue, check if there is a linked failed finalize:

```bash
gh issue view {issue_number} --comments
```

Look in the comments for:
- `Fix release vX.Y.Z finalize failure` — failed finalize that needs retry
- `Tracking this cycle: Issue #N` — indicates this is a retry chain

**If a failed finalize is found:**
1. Extract the version `vX.Y.Z` from the fix issue title
2. Extract the tracking issue number
3. Proceed to **Step 4** to check if the release PR is already merged to dev
4. If PR is merged, proceed to **Step 5** to retry finalize

**If no failed finalize found, but open tracking issue exists:**
- Extract the version from the issue title
- Go to **Step 3** to check if the release PR is already created

**Otherwise:** Proceed to Step 2 to create a new tracking issue and run a fresh release.

> **Important:** Only create a new release if no prior cycle is in progress or failed. A prior cycle that failed finalize should always be retried with the same version, not a new one.

---

## Step 2: Create tracking issue

1. Read `package.json` to get the current version (this is the base version — the new version will be determined by `kody-engine release`).
2. Create a GitHub issue with:
   - Title: `Release v{current_version}` (the new version will appear in the PR title)
   - Labels: `kody:watch:release`
   - Body: Brief description stating this issue tracks the release, including the current date.

```bash
gh issue create --title "Release v{version}" --label "kody:watch:release" --body "Release tracking issue — created by kody watch."
```

Save the issue number — all subsequent steps will post comments on this issue.

---

## Step 3: Run kody-engine release (or skip if PR already exists)

Check if a release PR already exists for this version:

```bash
gh pr list --head "release/v{new_version}" --state all --json number,title,url,state
```

**If PR already exists and is MERGED:** Go to **Step 4**.
**If PR exists and is OPEN:** Skip `kody-engine release`, post a comment noting it already exists, and go to **Step 4**.
**If no PR exists:** Run the release command:

```bash
kody-engine release
```

This will:
- Analyze commits since the last tag
- Determine the new version (major/minor/patch)
- Update version files and generate changelog
- Create `release/v{new_version}` branch
- Create a PR `release/v{new_version}` → `dev`
- Label the PR with `kody:release`

After `kody-engine release` completes, extract the **new version** from the PR title (format: `chore: release v1.2.3`).

If `package.json` version was bumped, regenerate `pnpm-lock.yaml` to avoid CI failures:

```bash
pnpm install
git add pnpm-lock.yaml
git commit --amend --no-edit
git push
```

Post a comment on the tracking issue:
```
✅ Release PR created: {PR_URL}
Version: {new_version}
Waiting for CI to pass before merging...
```

---

## Step 4: Merge release PR to dev

Poll the PR until it is mergeable and CI passes:

```bash
# Find the release PR
gh pr list --head "release/v{new_version}" --state open --json number,title,url,mergeableState

# Check CI status
gh pr checks "release/v{new_version}"

# Check mergeability
gh pr view "release/v{new_version}" --json mergeableState --jq '{mergeableState}'
```

**Keep polling** (with a short delay between checks) until:
- `mergeableState` is `MERGEABLE`
- All CI checks have passed
- The PR state is `OPEN`

**If PR is already merged:** Skip polling and go directly to finalize.

Once ready, merge the PR:

```bash
gh pr merge "release/v{new_version}" --squash --auto
```

Post on the tracking issue:
```
✅ Merged to dev: release/v{new_version} → dev
Running finalize...
```

---

## Step 5: Run kody release --finalize via GitHub Actions workflow

Once merged to dev, trigger the `kody` workflow to run finalize. kody-engine is not available in this environment — use `gh workflow run` to dispatch it:

```bash
gh workflow run kody.yml \
  --field task_id=release-finalize-{$issue_number}-$(date +%Y%m%d%H%M%S) \
  --field mode=release \
  --field finalize=true \
  --field issue_number={$issue_number} \
  --field dry_run=false
```

Replace `{$issue_number}` with the tracking issue number. The version is determined automatically from the `package.json` on the dev branch (which was already bumped in Step 3).

After triggering, capture the run ID and poll until completion:

```bash
# Trigger the workflow and capture the run ID
WORKFLOW_RUN_ID=$(gh workflow run kody.yml \
  --field task_id=release-finalize-{$issue_number}-$(date +%Y%m%d%H%M%S) \
  --field mode=release \
  --field finalize=true \
  --field issue_number={$issue_number} \
  --field dry_run=false \
  --repo $REPO | grep -oE '[0-9]+$')

# Poll until the workflow completes (can take 10-30 minutes due to E2E gate)
gh run view $WORKFLOW_RUN_ID --json status,conclusion --repo $REPO
# Keep polling with a delay until status is "completed"
```

This will:
1. **E2E gate** — runs e2e tests first (blocks everything if it fails)
2. **Tag** — creates and pushes `v{new_version}` tag
3. **GitHub Release** — creates the GitHub Release
4. **Publish** — runs the publish command
5. **Notify** — runs the notify command

**If finalize fails at any step:**
- Post the error on the tracking issue
- Create a new issue to fix the errors (title: `Fix release v{new_version} finalize failure`)
- Include the error details in the issue body
- Exit — do NOT proceed to Step 6

Post on the tracking issue after finalize succeeds:
```
🚀 Finalize complete!
- Tag: `v{new_version}`
- GitHub Release: {release_url}
- Published
- Notification sent
Creating promotion PR dev → main...
```

---

## Step 6: Create and merge promotion PR dev → main

After finalize succeeds, check if the promotion PR already exists:

```bash
gh pr list --base main --head dev --state all --json number,title,state
```

**If PR already exists and is MERGED:** Skip to the final comment.
**If PR exists and is OPEN:** Poll until CI passes, then merge.

Otherwise, create the PR:

```bash
# Create PR dev → main
gh pr create --base main --head dev --title "Publish dev → production" --body "Promotion PR — no code changes, just merge dev to main for production release."
```

Wait for the PR to be mergeable and CI to pass:

```bash
gh pr view {PR_NUMBER} --json mergeableState
gh pr checks {PR_NUMBER}
```

Once ready, merge:

```bash
gh pr merge {PR_NUMBER} --squash --auto
```

Post on the tracking issue:
```
✅ Merged to main: dev → main
Production release v{new_version} complete!
```

Close the tracking issue after completion.

---

## Notes

- Always check for existing open `kody:watch:release` issues before creating a new one.
- **Failed finalize must be retried, not restarted.** If a finalize fails, always retry with the same version — do not run `kody-engine release` again, as that creates a new version.
- Extract the new version from the PR title created by `kody-engine release` — do not try to compute it yourself.
- If E2E fails in Step 5, create a fix issue and exit — do NOT proceed to Step 6.
- Use `gh pr view` and `gh pr checks` to monitor status; do not guess or assume.
- The promotion PR (Step 6) has no code changes — it only exists to trigger any CI/CD that runs on merge to main.
- Always check if PRs already exist before creating them — this makes the agent idempotent for retry scenarios.
