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

# Helper: Write default output values (used on error paths)
write_defaults() {
  echo "task_id=" >> "$GITHUB_OUTPUT"
  echo "mode=full" >> "$GITHUB_OUTPUT"
  echo "clarify=false" >> "$GITHUB_OUTPUT"
  echo "dry_run=false" >> "$GITHUB_OUTPUT"
  echo "from_stage=" >> "$GITHUB_OUTPUT"
  echo "feedback=" >> "$GITHUB_OUTPUT"
  echo "trigger_type=" >> "$GITHUB_OUTPUT"
  echo "comment_body=" >> "$GITHUB_OUTPUT"
}

# Initialize output variables (will be written once at the end)
OUTPUT_TASK_ID=""
OUTPUT_MODE="full"
OUTPUT_CLARIFY="false"
OUTPUT_DRY_RUN="false"
OUTPUT_FROM_STAGE=""
OUTPUT_FEEDBACK=""
OUTPUT_ISSUE_NUMBER=""
OUTPUT_TRIGGER_TYPE=""
OUTPUT_COMMENT_BODY=""
OUTPUT_VALID="false"

# Handle workflow_dispatch
if [[ "$GITHUB_EVENT_NAME" == "workflow_dispatch" ]]; then
  if [[ -z "${DISPATCH_TASK_ID:-}" ]]; then
    echo "=== Error: task_id is required for dispatch ==="
    write_defaults
    echo "issue_number=" >> "$GITHUB_OUTPUT"
    echo "valid=false" >> "$GITHUB_OUTPUT"
    exit 0
  fi

  # Set output variables for dispatch
  OUTPUT_TASK_ID="$DISPATCH_TASK_ID"
  OUTPUT_MODE="${DISPATCH_MODE:-full}"
  OUTPUT_CLARIFY="${DISPATCH_CLARIFY:-false}"
  OUTPUT_DRY_RUN="${DISPATCH_DRY_RUN:-false}"
  OUTPUT_FEEDBACK="${DISPATCH_FEEDBACK:-}"
  OUTPUT_FROM_STAGE="${DISPATCH_FROM_STAGE:-}"
  OUTPUT_TRIGGER_TYPE="dispatch"
  OUTPUT_VALID="true"
  echo "=== Parsed dispatch: task_id=$OUTPUT_TASK_ID, mode=$OUTPUT_MODE, clarify=$OUTPUT_CLARIFY ==="
else
  # Handle issue_comment
  # Safety check first
  if [[ "${SAFETY_VALID:-}" != "true" ]]; then
    echo "=== Safety check failed: ${SAFETY_REASON:-unknown} ==="
    write_defaults
    echo "issue_number=${ISSUE_NUMBER:-}" >> "$GITHUB_OUTPUT"
    echo "valid=false" >> "$GITHUB_OUTPUT"
    exit 0
  fi

  # Discover task-id from previous bot comments on the issue
  # This allows the second /cody call to pick up the same task-id
  # Note: Don't filter by author - comments can be posted by various bots (github-actions[bot], GitHub Apps, etc.)
  if [[ -n "${ISSUE_NUMBER:-}" ]]; then
    OUTPUT_ISSUE_NUMBER="$ISSUE_NUMBER"
    # Use \+ to require at least one character in slug (matches cody-utils.ts regex)
    DISCOVERED_TASK_ID=$(gh issue view "$ISSUE_NUMBER" --json comments --jq '.comments[].body' 2>/dev/null | grep -o 'Task created: `[0-9]\{6\}-[a-zA-Z0-9-]\+' | sed 's/Task created: `//' | head -1 || true)
    if [[ -n "$DISCOVERED_TASK_ID" ]]; then
      echo "=== Discovered task-id from issue: $DISCOVERED_TASK_ID ==="
      OUTPUT_TASK_ID="$DISCOVERED_TASK_ID"
    fi
  fi

  # Pass raw comment body to orchestrator for parsing
  # Escape for JSON/GITHUB_OUTPUT (replace newlines, quotes)
  # Use printf '%s' to avoid echo's trailing newline being captured by jq
  OUTPUT_COMMENT_BODY=$(printf '%s' "${COMMENT_BODY:-}" | jq -Rs .)
  OUTPUT_TRIGGER_TYPE="comment"
  OUTPUT_VALID="true"
  echo "=== Passing comment to orchestrator for parsing ==="
fi

# Write all outputs (no duplicates - each key written exactly once)
echo "task_id=${OUTPUT_TASK_ID}" >> "$GITHUB_OUTPUT"
echo "mode=${OUTPUT_MODE}" >> "$GITHUB_OUTPUT"
echo "clarify=${OUTPUT_CLARIFY}" >> "$GITHUB_OUTPUT"
echo "dry_run=${OUTPUT_DRY_RUN}" >> "$GITHUB_OUTPUT"
echo "from_stage=${OUTPUT_FROM_STAGE}" >> "$GITHUB_OUTPUT"
echo "feedback=${OUTPUT_FEEDBACK}" >> "$GITHUB_OUTPUT"
echo "issue_number=${OUTPUT_ISSUE_NUMBER}" >> "$GITHUB_OUTPUT"
echo "trigger_type=${OUTPUT_TRIGGER_TYPE}" >> "$GITHUB_OUTPUT"
echo "comment_body=${OUTPUT_COMMENT_BODY}" >> "$GITHUB_OUTPUT"
echo "valid=${OUTPUT_VALID}" >> "$GITHUB_OUTPUT"
