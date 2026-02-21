#!/usr/bin/env bash
# checkout-task-branch.sh - Checkout existing feature branch for a task
# Called by cody.yml orchestrate job when task_id is known
#
# Required env vars: TASK_ID

set -euo pipefail

# BUG-8 fix: Fetch latest remote refs before checking for branches
git fetch origin

# Try common branch prefixes for the task-id
for prefix in feat fix refactor docs chore security test; do
  BRANCH="${prefix}/${TASK_ID}"
  if git rev-parse --verify "origin/${BRANCH}" >/dev/null 2>&1; then
    echo "=== Found feature branch: $BRANCH ==="
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    exit 0
  fi
done

echo "=== No feature branch found for $TASK_ID, staying on default branch ==="
