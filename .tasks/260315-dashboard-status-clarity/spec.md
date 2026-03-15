# Dashboard Task Status Clarity

## Problem
- Task statuses on the Cody dashboard are unclear to users
- "Awaiting Analyzing" text appears for gate-paused tasks at `taskify` stage — confusing combination of "Awaiting" prefix + "Analyzing" stage label
- Status text appears even when a task is actively in-progress, making it look like it's waiting when it's actually running
- Stage labels like "Analyzing" (for `taskify`) are too vague — users don't know what the system is doing

## User Report
> dashboard task statuses is still not clear, awaiting analyzing is not clear, appears even when task is in progress

## Root Cause
1. `stageLabels.taskify = 'Analyzing'` is vague — should be more descriptive
2. Gate-paused display text template is `"Awaiting {label}"` which produces "Awaiting Analyzing" — grammatically awkward and unclear
3. The `derivePipelineDisplayState()` function correctly detects pipeline state, but the text rendered from it is confusing
4. Some tasks show gate-paused text when they should show active-progress text (pipeline.state check may not match column)

## Requirements
- REQ-1: Improve stage labels to be more descriptive and user-friendly
- REQ-2: Improve gate-paused text format to be clearer (e.g., "Paused: Waiting for approval" or "Approval needed at [stage]")
- REQ-3: Ensure active/in-progress tasks show active verbiage (not "awaiting")
- REQ-4: Improve banner and inline status text to be more specific about what Cody is doing
- REQ-5: All existing tests must continue to pass (update assertions for new labels)
