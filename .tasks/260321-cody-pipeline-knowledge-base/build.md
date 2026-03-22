# Build Agent Report: 260321-cody-pipeline-knowledge-base

## Problem

The Cody pipeline uses opencode for agent execution but did not persist or accumulate new data learned during pipeline runs. Specifically:

1. **Knowledge base only read, never written** - The `architect` stage read `.ai-docs/knowledge/index.json` but nothing in the pipeline wrote to it
2. **Failure patterns not persisted** - When verify failed and then succeeded on retry, the error patterns weren't recorded
3. **No cross-task learning** - Each task started fresh without learning from previous tasks

## Changes

### New Files

- **`scripts/cody/pipeline/post-actions/knowledge-base.ts`** - New post-action module that updates the cross-task knowledge base after task completion. Captures:
  - Task domain and type (from `task.json`)
  - Complexity score
  - Patterns detected (from scope text and error categories)
  - Feedback loops needed (indicates difficulty)
  - Error patterns encountered during verify failures

### Modified Files

- **`scripts/cody/engine/types.ts`** - Added `UpdateKnowledgeBaseAction` type and added it to the `PostAction` discriminated union
- **`scripts/cody/pipeline/post-actions/index.ts`** - Added import and case handler for `update-knowledge-base` post-action
- **`scripts/cody/pipeline/definitions.ts`** - Added `{ type: 'update-knowledge-base' }` to the verify stage postActions (runs after verify succeeds)

## How It Works

1. After the verify stage completes successfully (with or without fix retries), the `update-knowledge-base` post-action runs
2. It reads `task.json` to get task metadata (domain, type, complexity, scope)
3. It reads `verify-failures.md` if it exists to extract error patterns that were encountered
4. It loads the existing knowledge base from `.ai-docs/knowledge/index.json`
5. It creates a new entry with the learned patterns and adds it to the knowledge base
6. It updates pattern frequency counts for future reference
7. The architect stage reads this knowledge base for future tasks

## Knowledge Entry Structure

```json
{
  "taskId": "260321-auto-xxx",
  "date": "2026-03-21T...",
  "domain": "frontend|backend|infra|ai|auth|testing",
  "taskType": "fix_bug|implement_feature|refactor|...",
  "complexity": 17,
  "patterns": ["type-error", "css-styling", "iterative-fix", ...],
  "summary": "scope item 1, scope item 2, ...",
  "feedbackLoops": 2,
  "errorPatterns": ["type_error", "lint_error"]
}
```

## Quality

- TypeScript: PASS (no new errors in modified files)
- Lint: PASS (only pre-existing warnings in unrelated files)

## Delegation Results

This was implemented directly without delegation - single territory (Cody pipeline).

## Tests Written

No unit tests written for this change - the post-action is a simple data transformation that logs results. Integration testing would require running a full pipeline.

## Deviations

None - plan followed exactly.

## Additional Notes

The knowledge base update is non-blocking - if it fails (e.g., due to file permissions or JSON parsing errors), it logs a warning and continues the pipeline. This ensures knowledge base issues don't block task completion.