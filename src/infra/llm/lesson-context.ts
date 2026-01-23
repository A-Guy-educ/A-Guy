/**
 * Lesson Context Injection
 *
 * Single-responsibility module for injecting lesson-level textual context
 * into chat prompts at runtime. Lesson context is NEVER persisted in
 * conversations or messages.
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern single-responsibility, runtime-injection
 */

export const LESSON_CONTEXT_MAX_CHARS = 100_000 // ~50K tokens
export const LESSON_CONTEXT_BLOCK_START = 'LESSON_CONTEXT_START'
export const LESSON_CONTEXT_BLOCK_END = 'LESSON_CONTEXT_END'

/**
 * Builds a system prompt with lesson context injected.
 *
 * If lessonContextText is provided, it is wrapped in delimiters and appended
 * to the base system prompt. If lessonContextText is undefined, null, or empty,
 * the original baseSystemPrompt is returned unchanged.
 *
 * @param baseSystemPrompt - The base system prompt to enhance
 * @param lessonContextText - Optional lesson context text to inject
 * @returns Enhanced system prompt with lesson context, or original if no context
 * @throws Error if lessonContextText exceeds LESSON_CONTEXT_MAX_CHARS
 */
export function buildLessonContextPrompt(
  baseSystemPrompt: string,
  lessonContextText: string | undefined | null,
): string {
  if (!lessonContextText?.trim()) return baseSystemPrompt

  if (lessonContextText.length > LESSON_CONTEXT_MAX_CHARS) {
    throw new Error(`Lesson context exceeds maximum allowed size`)
  }

  return [
    baseSystemPrompt,
    '',
    LESSON_CONTEXT_BLOCK_START,
    '## Lesson Context',
    lessonContextText.trim(),
    LESSON_CONTEXT_BLOCK_END,
  ].join('\n')
}
