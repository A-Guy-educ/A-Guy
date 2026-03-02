# Study Plan Engine: Anchor Schedule to Exam Countdown

## Overview

Modify the study plan engine to consistently anchor generated day dates to the final exam countdown window (exam-6 through exam day).

## Requirements

### FR-1: Exam Countdown Anchoring
Generated day dates must always be anchored to the final exam countdown window, not to "today".

### FR-2: Target Window Definition
- Target window: `examDate - 6` through `examDate` (inclusive)
- Maximum of 7 days in the countdown window

### FR-3: Partial Window Handling
If fewer than 7 days are available before the exam, generate only the available days ending on exam day.

### FR-4: Warm-up Mode for daysUntilExam = 1
When `daysUntilExam = 1`, the system must produce warm-up mode behavior.

### FR-5: No Regression
Existing engine topic assignment outputs must not regress.

## Acceptance Criteria

- [ ] Date sequence matches exam-6..exam day (or shorter when needed)
- [ ] 2-day, 5-day, 7-day, 10-day scenarios pass deterministic tests
- [ ] No regressions in existing engine topic assignment outputs
