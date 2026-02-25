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

  # FIX #3: Validate task-id format for dispatch
  if ! [[ "$OUTPUT_TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]; then
    echo "=== Error: Invalid task-id format: $OUTPUT_TASK_ID ==="
    echo "Expected format: YYMMDD-description (e.g., 260225-auto-90)"
    write_defaults
    echo "issue_number=" >> "$GITHUB_OUTPUT"
    echo "valid=false" >> "$GITHUB_OUTPUT"
    exit 0
  fi

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

  # Detect commands - @cody, @cody approve, /cody, /cody full, etc.
  # Determine the mode based on the command
  NORMALIZED_COMMENT=$(echo "${COMMENT_BODY:-}" | tr '[:upper:]' '[:lower:]' | xargs || true)
  if [[ -n "$NORMALIZED_COMMENT" ]]; then
    # Remove /cody or @cody prefix to get the command/arguments
    CMD_AFTER_CODY=$(echo "$NORMALIZED_COMMENT" | sed 's/^[\/]@*cody[[:space:]]*//' | xargs || true)
    
    # Check if it's an approval command (approve, approved, yes, go, proceed, y, continue)
    APPROVAL_KEYWORDS="approve approved yes go proceed y continue"
    IS_APPROVAL=false
    
    if [[ -z "$CMD_AFTER_CODY" ]]; then
      # @cody alone - default to full mode (fresh pipeline run)
      OUTPUT_MODE="full"
      echo "=== @cody alone - defaulting to full mode ==="
    else
      # Check if it's an approval keyword (exact match only)
      for keyword in $APPROVAL_KEYWORDS; do
        if [[ "$CMD_AFTER_CODY" == "$keyword" ]]; then
          IS_APPROVAL=true
          echo "=== Detected approval keyword: $keyword ==="
          break
        fi
      done
      
      if [[ "$IS_APPROVAL" == "true" ]]; then
        # Approval commands use rerun mode to check for approval
        OUTPUT_MODE="rerun"
      else
        # Check if it's a valid mode (spec, impl, rerun, full, status)
        VALID_MODES="spec impl rerun full status"
        IS_VALID_MODE=false
        for mode in $VALID_MODES; do
          if [[ "$CMD_AFTER_CODY" == "$mode" ]]; then
            OUTPUT_MODE="$mode"
            IS_VALID_MODE=true
            echo "=== Detected explicit mode: $mode ==="
            break
          fi
        done
        
        # If not a valid mode, treat as full (might be a task-id or description)
        if [[ "$IS_VALID_MODE" == "false" ]]; then
          OUTPUT_MODE="full"
          echo "=== Not a known command - defaulting to full mode ==="
        fi
      fi
    fi
  fi

  # FIX #3: Validate task-id format if set (prevents "Invalid task-id format: TEST" errors)
  # Format: YYMMDD-description (e.g., 260225-auto-90)
  if [[ -n "$OUTPUT_TASK_ID" ]] && ! [[ "$OUTPUT_TASK_ID" =~ ^[0-9]{6}-[a-zA-Z0-9-]+$ ]]; then
    echo "=== Error: Invalid task-id format: $OUTPUT_TASK_ID ==="
    echo "Expected format: YYMMDD-description (e.g., 260225-auto-90)"
    # Set default but mark as invalid
    OUTPUT_TASK_ID=""
    OUTPUT_VALID="false"
  fi

  # Pass raw comment body to orchestrator for parsing
  # Escape for JSON/GITHUB_OUTPUT (replace newlines, quotes)
  # Use printf '%s' to avoid echo's trailing newline being captured by jq
  OUTPUT_COMMENT_BODY=$(printf '%s' "${COMMENT_BODY:-}" | jq -Rs .)
  OUTPUT_TRIGGER_TYPE="comment"
  # Only set valid=true if not already marked invalid by task-id validation
  if [[ "$OUTPUT_VALID" != "false" ]]; then
    OUTPUT_VALID="true"
  fi
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
