# Build Agent Report: cody-gate-questions

## Changes

- **scripts/cody/pipeline-utils.ts**: Added `review_questions?: string[]` field to TaskDefinition interface, added validation and normalization for the new field, updated dry-run output template
- **scripts/cody/clarify-workflow.ts**: Updated `formatGateComment()` to accept and render `review_questions` as a numbered list after assumptions, updated `handleGateApproval()` to read and pass `review_questions` from task.json
- **.opencode/agents/taskify.md**: Added `review_questions` to JSON output contract, added "Review Questions (Gate Guidance)" section with instructions for generating clear, actionable questions
- **tests/unit/scripts/cody/clarify-workflow.test.ts**: Added 4 new tests for review_questions feature (includes review_questions from task.json, omits when empty, shows both assumptions and review_questions)

## Tests Written

- `tests/unit/scripts/cody/clarify-workflow.test.ts` - 4 new tests for review_questions:
  - "includes review_questions from task.json when present"
  - "omits review questions section when task.json has no review_questions"
  - "shows both assumptions and review_questions when both present"

## Quality

- TypeScript: PASS
- Lint: PASS
- Unit Tests: PASS (2657 tests passing)

## Summary

Added `review_questions` field to the Cody pipeline gate system. This allows the taskify agent to generate explicit questions that reviewers should answer before approving a task. Gate comments now show both:

1. **Assumptions** (what the system assumed) - existing
2. **Review Questions** (explicit questions for the reviewer) - new

This addresses the issue where gates only surfaced assumptions without clear questions, making it harder for reviewers to make informed approval decisions.
