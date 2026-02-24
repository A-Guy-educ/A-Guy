#!/usr/bin/env bash
# run-cody.sh - Executed by GitHub Actions to run the Cody pipeline
# All config comes from environment variables (set in the YAML env block)

set -euo pipefail

echo "=== Starting Cody ==="
echo "Task: $TASK_ID"
echo "Mode: $MODE"
echo "Clarify: $CLARIFY"
echo "Dry run: $DRY_RUN"
echo "Trigger: $TRIGGER_TYPE"

# Build dry-run flag
DRY_RUN_FLAG=""
if [[ "$DRY_RUN" == "true" ]]; then
  DRY_RUN_FLAG="--dry-run"
fi

# Build clarify flag (opt-in to Q&A loop)
CLARIFY_FLAG=""
if [[ "$CLARIFY" == "true" ]]; then
  CLARIFY_FLAG="--clarify"
fi

# Build comment-body flag (only for comment triggers)
# BUG-11 fix: Pass COMMENT_BODY via environment variable instead of shell interpolation
# to avoid command injection when COMMENT_BODY contains $(), backticks, etc.
COMMENT_BODY_FLAG=""
if [[ -n "${COMMENT_BODY:-}" ]] && [[ "$TRIGGER_TYPE" == "comment" ]]; then
  COMMENT_BODY_FLAG="--comment-body-env=COMMENT_BODY"
fi

# Run Cody with all flags
# Note: Uses 'pnpm cody' which points to entry.ts via package.json
pnpm cody \
  --task-id="${TASK_ID:-}" \
  --mode="$MODE" \
  --issue-number="${ISSUE_NUMBER:-}" \
  --trigger-type="$TRIGGER_TYPE" \
  ${RUN_ID:+--run-id="$RUN_ID"} \
  ${RUN_URL:+--run-url="$RUN_URL"} \
  ${CLARIFY_FLAG:+"$CLARIFY_FLAG"} \
  ${DRY_RUN_FLAG:+"$DRY_RUN_FLAG"} \
  ${COMMENT_BODY_FLAG:+"$COMMENT_BODY_FLAG"} \
  ${FEEDBACK:+--feedback="$FEEDBACK"} \
  ${FROM_STAGE:+--from="$FROM_STAGE"}
