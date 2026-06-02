## Task 2354: docs-drift AI Services / lesson-duplication-variation-service

**Conclusion: No doc update needed — PR #2348 is doc-irrelevant.**

### What PR #2348 changed (internal bug fixes only)

Two changes in `src/infra/llm/services/lesson-duplication-variation-service.ts`:

1. **`sanitizeAiBlocks`** — Added handling for `question_geometry`/`question_axis` blocks:
   - These block types have a discriminated union answer keyed on `kind` (one of: numeric, mcq, free_response, point, function).
   - Gemini sometimes emits invalid `kind` values (e.g. "freeResponse" camelCase or a typo).
   - Fix: if `kind` is not in `ALLOWED_KINDS`, delete the entire `answer` field (answer is optional on these blocks; admin can fill it in on review).

2. **`parseSolutionDerivationResponseFromText`** — Normalize bare array responses:
   - Gemini occasionally returns the bare patch array `[...]` instead of the expected `{blocks: [...]}` envelope.
   - Observed live on a geometry deep run.
   - Fix: wrap bare array in `{ blocks: parsed }` before Zod validation.

### Why the doc doesn't need updating

`docs/ai-services/README.md` does not describe the lesson duplication service at all — it only covers Data Extractor, Exercise Chat, and Image Optimizer. The PR made no interface or behavior changes visible to a reader of that doc. The doc was already equally "stale" before this PR (i.e., it simply doesn't cover this service).

### Note on broader doc gap

`docs/ai-services/README.md` is missing coverage of the lesson duplication/variation service entirely. This is a pre-existing gap, not something caused by PR #2348. A separate update would be needed to add that service to the doc, but it is out of scope for this task.
