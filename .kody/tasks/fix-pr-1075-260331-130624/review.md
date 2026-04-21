Now I have a complete picture. Let me compile the structured review:

## Verdict: PASS (with minor informational findings)

## Summary

This PR implements PDF-to-exercise extraction quality improvements: (1) raises PDF_TO_EXERCISE temperature from 0 to 0.1 for better extraction quality, (2) adds exercise count validation with retry logic when extraction yields fewer exercises than expected, (3) fixes a CONTENT_TRANSLATION model mapping bug, and (4) passes temperature to Genkit's `ai.generate()` call.

## Findings

### Critical

None.

### Major

None.

### Minor

**`src/infra/llm/genkit/adapters/unified-adapter.ts:175`** — `generateStreamingChatCompletion` does not pass `temperature` to `ai.generateStream()`, unlike `generateChatCompletion` (line 130) and `generateMultimodalCompletion` (lines 248-251). The `config` object containing `temperature` is resolved but unused. Streaming completions will use the model's default temperature while non-streaming calls use the configured temperature.

**`src/server/services/lesson-context-conversion/extract-context.ts:238`** — `countExercises` regex `/\\textbf\{תרגיל \d+\}/g` is Hebrew-language-specific and assumes Bagrut exam formatting. Exercises using alternative LaTeX markup (e.g., `\textbf{Question 1}`, `\textbf{שאלה 1}`, or other variants) will not be counted, potentially causing spurious retries for non-standard PDFs. The formula `Math.max(3, Math.floor((pdfPageCount - 2) * 0.5))` is also calibrated for Bagrut exams and may underestimate exercise counts for other document types.

### Informational

- **Test updates (`tests/int/llm-model-reply-validation.int.spec.ts:114,343,398`)** — Comments correctly updated to reflect new temperature value (0.1), test assertions updated accordingly.

- **Config consistency** — The `contentTranslation` entry added to `chat-config.ts` (lines 84-89) properly aligns with `ChatConfig` interface and `MODEL_REGISTRY.CONTENT_TRANSLATION` entry in `models.ts`.

- **Retry logic (`extract-context.ts:251-258`)** — The retry reuses the identical `fullPrompt`. This may not improve results if the underlying issue is the model consistently misinterpreting the document structure, but it's a reasonable first attempt.
