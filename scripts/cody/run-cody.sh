#!/usr/bin/env bash
# run-cody.sh - Executed by GitHub Actions to run the Cody pipeline
# All config comes from environment variables (set in the YAML env block)

set -euo pipefail

echo "=== Starting Cody ==="
echo "Task: $TASK_ID"
echo "Mode: $MODE"
echo "Dry run: $DRY_RUN"
echo "Trigger: $TRIGGER_TYPE"

# Post starting comment (only when task-id is known)
if [[ -n "${ISSUE_NUMBER:-}" ]] && [[ -n "${TASK_ID:-}" ]]; then
  gh issue comment "$ISSUE_NUMBER" --body "🔄 Cody starting for \`${TASK_ID}\` (mode: $MODE)
Run: $RUN_URL"
fi

# Build dry-run flag
DRY_RUN_FLAG=""
if [[ "$DRY_RUN" == "true" ]]; then
  DRY_RUN_FLAG="--dry-run"
fi

# Build comment-body flag (only for comment triggers)
COMMENT_BODY_FLAG=""
if [[ -n "${COMMENT_BODY:-}" ]] && [[ "$TRIGGER_TYPE" == "comment" ]]; then
  COMMENT_BODY_FLAG="--comment-body=$COMMENT_BODY"
fi

# Run Cody with all flags
pnpm cody:run \
  --task-id="${TASK_ID:-}" \
  --mode="$MODE" \
  --issue-number="${ISSUE_NUMBER:-}" \
  --trigger-type="$TRIGGER_TYPE" \
  ${RUN_ID:+--run-id="$RUN_ID"} \
  ${RUN_URL:+--run-url="$RUN_URL"} \
  $DRY_RUN_FLAG \
  ${COMMENT_BODY_FLAG:+"$COMMENT_BODY_FLAG"} \
  ${FEEDBACK:+--feedback="$FEEDBACK"} \
  ${FROM_STAGE:+--from="$FROM_STAGE"}
