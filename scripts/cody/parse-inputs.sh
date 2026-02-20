#!/usr/bin/env bash
# parse-inputs.sh - Parse command inputs from dispatch or comment triggers
# Called by cody.yml parse job
#
# Required env vars:
#   GITHUB_EVENT_NAME - 'workflow_dispatch' or 'issue_comment'
#   GITHUB_OUTPUT     - GitHub Actions output file
#   GH_TOKEN          - GitHub token (for gh CLI)
#
# For workflow_dispatch:
#   DISPATCH_TASK_ID, DISPATCH_MODE, DISPATCH_DRY_RUN,
#   DISPATCH_FEEDBACK, DISPATCH_FROM_STAGE
#
# For issue_comment:
#   SAFETY_VALID, SAFETY_REASON, COMMENT_BODY, ISSUE_NUMBER

set -euo pipefail

# Default outputs (task_id intentionally omitted — set later after discovery)
echo "mode=full" >> "$GITHUB_OUTPUT"
echo "clarify=false" >> "$GITHUB_OUTPUT"
echo "dry_run=false" >> "$GITHUB_OUTPUT"
echo "from_stage=" >> "$GITHUB_OUTPUT"
echo "feedback=" >> "$GITHUB_OUTPUT"
echo "issue_number=${ISSUE_NUMBER:-}" >> "$GITHUB_OUTPUT"
echo "trigger_type=" >> "$GITHUB_OUTPUT"
echo "comment_body=" >> "$GITHUB_OUTPUT"
echo "valid=false" >> "$GITHUB_OUTPUT"

# Handle workflow_dispatch
if [[ "$GITHUB_EVENT_NAME" == "workflow_dispatch" ]]; then
  if [[ -z "${DISPATCH_TASK_ID:-}" ]]; then
    echo "=== Error: task_id is required for dispatch ==="
    exit 0
  fi
  echo "task_id=$DISPATCH_TASK_ID" >> "$GITHUB_OUTPUT"
  echo "mode=${DISPATCH_MODE:-full}" >> "$GITHUB_OUTPUT"
  echo "clarify=${DISPATCH_CLARIFY:-false}" >> "$GITHUB_OUTPUT"
  echo "dry_run=${DISPATCH_DRY_RUN:-false}" >> "$GITHUB_OUTPUT"
  echo "feedback=${DISPATCH_FEEDBACK:-}" >> "$GITHUB_OUTPUT"
  echo "from_stage=${DISPATCH_FROM_STAGE:-}" >> "$GITHUB_OUTPUT"
  echo "trigger_type=dispatch" >> "$GITHUB_OUTPUT"
  echo "valid=true" >> "$GITHUB_OUTPUT"
  echo "=== Parsed dispatch: task_id=$DISPATCH_TASK_ID, mode=${DISPATCH_MODE:-full}, clarify=${DISPATCH_CLARIFY:-false} ==="
  exit 0
fi

# Handle issue_comment
# Safety check first
if [[ "${SAFETY_VALID:-}" != "true" ]]; then
  echo "=== Safety check failed: ${SAFETY_REASON:-unknown} ==="
  exit 0
fi

# Discover task-id from previous bot comments on the issue
# This allows the second /cody call to pick up the same task-id
DISCOVERED_TASK_ID=""
if [[ -n "${ISSUE_NUMBER:-}" ]]; then
  DISCOVERED_TASK_ID=$(gh issue view "$ISSUE_NUMBER" --json comments --jq '[.comments[] | select(.author.login == "github-actions[bot]")] | .[].body' 2>/dev/null | grep -o 'Task created: `[0-9]\{6\}-[a-zA-Z0-9-]*' | sed 's/Task created: `//' | head -1 || true)
  if [[ -n "$DISCOVERED_TASK_ID" ]]; then
    echo "=== Discovered task-id from issue: $DISCOVERED_TASK_ID ==="
    echo "task_id=$DISCOVERED_TASK_ID" >> "$GITHUB_OUTPUT"
  fi
fi

# Pass raw comment body to orchestrator for parsing
# Escape for JSON/GITHUB_OUTPUT (replace newlines, quotes)
# Use printf '%s' to avoid echo's trailing newline being captured by jq
ESCAPED_BODY=$(printf '%s' "$COMMENT_BODY" | jq -Rs .)
echo "comment_body=$ESCAPED_BODY" >> "$GITHUB_OUTPUT"
echo "issue_number=$ISSUE_NUMBER" >> "$GITHUB_OUTPUT"
echo "trigger_type=comment" >> "$GITHUB_OUTPUT"
echo "valid=true" >> "$GITHUB_OUTPUT"
echo "=== Passing comment to orchestrator for parsing ==="
