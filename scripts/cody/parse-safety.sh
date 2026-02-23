#!/usr/bin/env bash
# parse-safety.sh - Validate comment trigger safety filters
# Called by cody.yml parse job for issue_comment events
#
# Required env vars: COMMENT_BODY, AUTHOR, ASSOCIATION
# Outputs (via GITHUB_OUTPUT): valid, reason

set -euo pipefail

# Bot filter: ignore comments from known bot accounts
# Match exact known bot names and [bot] suffix pattern (not substring)
if [[ "$AUTHOR" == "github-actions[bot]" ]] || [[ "$AUTHOR" == *"[bot]" ]]; then
  echo "valid=false" >> "$GITHUB_OUTPUT"
  echo "reason=bot" >> "$GITHUB_OUTPUT"
  exit 0
fi

# Author association: only OWNER, MEMBER, COLLABORATOR
if [[ "$ASSOCIATION" != "OWNER" ]] && [[ "$ASSOCIATION" != "MEMBER" ]] && [[ "$ASSOCIATION" != "COLLABORATOR" ]]; then
  echo "valid=false" >> "$GITHUB_OUTPUT"
  echo "reason=unauthorized" >> "$GITHUB_OUTPUT"
  exit 0
fi

# Pattern: /cody must be on first line, @cody can be anywhere (mentioning is intentional)
# Extract first line for /cody check
FIRST_LINE=$(echo "$COMMENT_BODY" | head -1)
if ! echo "$FIRST_LINE" | grep -qE '^/cody([[:space:]]|$)' && ! echo "$COMMENT_BODY" | grep -qF '@cody'; then
  echo "valid=false" >> "$GITHUB_OUTPUT"
  echo "reason=pattern" >> "$GITHUB_OUTPUT"
  exit 0
fi

echo "valid=true" >> "$GITHUB_OUTPUT"
