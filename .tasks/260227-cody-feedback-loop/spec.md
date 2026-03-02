# Spec: Cody Pipeline Smart Feedback Loop

## Overview

Enhance the Cody pipeline with a comprehensive self-healing feedback loop that automatically retries failed stages with error context, enabling the pipeline to handle any issue from build through PR creation without human intervention.

## Requirements

### REQ-1: Build Stage Post-Action Autofix Loop
When `run-tsc` or `run-unit-tests` post-actions fail during the build stage, the pipeline should automatically invoke the autofix agent to fix the errors and retry, instead of immediately failing.

### REQ-2: Stage-Level Feedback Loop in State Machine
The state machine should support a configurable feedback loop where any stage failure triggers an automatic retry with error context injected into the agent prompt.

### REQ-3: Error Context Capture and Injection
All error output from failed quality gates (tsc, lint, format, tests) must be captured and passed as structured feedback to the retry agent.

### REQ-4: Configurable Max Feedback Iterations
Each stage should support a configurable `maxFeedbackLoops` (default: 2) that limits how many autofix cycles can run before declaring failure.

### REQ-5: Smart Error Classification
Classify errors into categories (type_error, lint_error, test_failure, runtime_error) so the feedback agent receives targeted fix instructions.

## Acceptance Criteria

1. Build stage tsc/test failures trigger autofix loop (not immediate failure)
2. Error output is captured and injected into retry prompts
3. Feedback loop respects max iteration limits
4. Pipeline can self-heal common issues without human intervention
5. All existing tests continue to pass
6. Status.json tracks feedback loop attempts
