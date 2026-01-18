/**
 * Composes final system instructions for AI chat
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern server-only
 */
import { buildLessonContextPrompt } from './lesson-context'

export const SYSTEM_PROMPT_SEPARATOR = '\n\n---\n\n'

/**
 * Composes final system instructions for AI chat.
 *
 * Order (deterministic):
 * 1. All published system prompts (joined with separator)
 * 2. Lesson-specific resolved prompt
 * 3. Lesson context text injection (via buildLessonContextPrompt)
 *
 * @param systemPrompts - Array of system prompt templates (can be empty)
 * @param lessonPromptTemplate - Resolved lesson prompt template
 * @param lessonContextText - Optional lesson context to inject
 * @returns Final composed system instructions string
 */
export function composeSystemInstructions(
  systemPrompts: string[],
  lessonPromptTemplate: string,
  lessonContextText?: string,
): string {
  // Step 1: Join system prompts (if any)
  const systemPart =
    systemPrompts.length > 0
      ? systemPrompts.join(SYSTEM_PROMPT_SEPARATOR) + SYSTEM_PROMPT_SEPARATOR
      : ''

  // Step 2: Append lesson prompt
  const withLessonPrompt = systemPart + lessonPromptTemplate

  // Step 3: Inject lesson context (reuse existing function)
  return buildLessonContextPrompt(withLessonPrompt, lessonContextText)
}
