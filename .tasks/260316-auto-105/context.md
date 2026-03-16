# Codebase Context: 260316-auto-105

## Task Summary

Ops task: Publish `dev` → `main` (233 commits). No code changes needed — existing GitHub Actions handle the workflow automatically.

## Files to Modify

None. This is a pure ops task with no code modifications.

## Files to Read (reference patterns)

- `.github/workflows/merge-dev-to-main.yml` — The workflow that creates the PR from `dev` → `main` when "publish" label is applied
- `.github/workflows/ci.yml` — CI pipeline that validates the PR

## Key Signatures

- Workflow trigger: `issues.types: [labeled]` with `github.event.label.name == 'publish'`
- PR creation: `gh pr create --base main --head dev --label publish`
- Ahead check: `git rev-list --count origin/main..origin/dev`

## Reuse Inventory

- `.github/workflows/merge-dev-to-main.yml` — entire publish workflow (PR creation, issue commenting, close-if-nothing)
- `.github/workflows/ci.yml` — automated CI checks on the PR

## Integration Points

- Issue #853 triggers the workflow via "publish" label
- GitHub Action creates PR from `dev` → `main`
- CI runs automatically on the PR
- User merges via dashboard or GitHub when CI passes
- PR body contains `Closes #853` to auto-close the issue on merge

## Imports Verified

N/A — no code changes required for this ops task.

## Build Agent Instructions

The build agent for this task should:
1. **NOT** create branches, modify files, or create commits
2. **NOT** create a PR (the GitHub Action does this)
3. Verify the publish workflow has been triggered or run
4. Report the status of the PR and CI checks
5. If the PR already exists, report its URL and CI status
