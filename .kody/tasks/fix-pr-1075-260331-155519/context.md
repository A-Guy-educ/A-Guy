### build (2026-03-31T16:06:12)

Integration tests passed (exit code 0). The fix is complete and verified.

### review (2026-03-31T16:09:51)

## Verdict: PASS

## Summary

This PR implements PDF-to-exercise extraction quality improvements: (1) passes temperature to Genkit's `ai.generate()` and `ai.generateStream()` calls, (2) fixes a CONTENT_TRANSLATION model mapping bug in config-resolver.ts, and (3) adds the contentTranslation model configuration to chat-config.ts.

## Findings

### Critical

None.

### Major

None.

### Minor

None.

---

## Two-Pass Review

**Pass 1 — CRITICAL (must fix before merge):**

### SQL & Data Safety

N/A
...(truncated)

### review-fix (2026-03-31T16:10:06)

Review-fix stage complete. Summary:

**Fix applied:** Added `config: { temperature: config.temperature }` to `ai.generateStream()` call in `generateStreamingChatCompletion` at line 175 of `src/infra/llm/genkit/adapters/unified-adapter.ts`.

**Verification:**

- TypeScript: Passes
- ESLint: Passes
- Prettier: Passes
- Integration tests: Pass (exit code 0)

The review found no Critical or Major issues - only the minor informational finding about streaming not passing temperature, which I fixed. T
...(truncated)
