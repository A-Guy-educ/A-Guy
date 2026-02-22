#!/usr/bin/env bash
# parse-safety-supervisor.sh - Validate comment trigger safety for supervisor workflow
# Called by supervisor.yml to validate failure comments from github-actions[bot]
#
# Required env vars: COMMENT_BODY, AUTHOR
# Outputs (via GITHUB_OUTPUT): valid, reason

set -euo pipefail

# Supervisor ONLY accepts failure comments from github-actions[bot]
# (the main cody workflow posts "❌ Pipeline failed for `task-id`:" comments)

# Must be github-actions[bot] (the account that posts failure comments)
if [[ "$AUTHOR" != "github-actions[bot]" ]]; then
  echo "valid=false" >> "$GITHUB_OUTPUT"
  echo "reason=not_bot" >> "$GITHUB_OUTPUT"
  exit 0
fi

# Must be a Cody failure comment pattern
if ! echo "$COMMENT_BODY" | grep -qE '^❌ Pipeline failed'; then
  echo "valid=false" >> "$GITHUB_OUTPUT"
  echo "reason=not_failure_comment" >> "$GITHUB_OUTPUT"
  exit 0
fi

echo "valid=true" >> "$GITHUB_OUTPUT"
