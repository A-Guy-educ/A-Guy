#!/usr/bin/env bash
# checkout-task-branch.sh - Checkout existing feature branch for a task
# Called by cody.yml orchestrate job when task_id is known
#
# Required env vars: TASK_ID

set -euo pipefail

# Configure git identity for CI (required for merge commits in GitHub Actions)
git config --global user.email "242132053+aguyaharonyair@users.noreply.github.com"
git config --global user.name "aguyaharonyair"

# BUG-8 fix: Fetch latest remote refs before checking for branches
git fetch origin

# Determine default branch (with fallback to 'dev')
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||')
DEFAULT_BRANCH="${DEFAULT_BRANCH:-dev}"

# Try common branch prefixes for the task-id
for prefix in feat fix refactor docs chore security test; do
  BRANCH="${prefix}/${TASK_ID}"
  if git rev-parse --verify "origin/${BRANCH}" >/dev/null 2>&1; then
    echo "=== Found feature branch: $BRANCH ==="
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    # Merge latest default branch into feature branch to keep it up-to-date
    echo "=== Merging latest $DEFAULT_BRANCH into $BRANCH ==="
    if ! git merge origin/${DEFAULT_BRANCH} --no-edit; then
      echo "=== CONFLICT: Merge of $DEFAULT_BRANCH into $BRANCH failed ==="
      echo "=== Aborting merge ==="
      git merge --abort
      exit 1
    fi
    exit 0
  fi
done

echo "=== No feature branch found for $TASK_ID, staying on default branch ==="
