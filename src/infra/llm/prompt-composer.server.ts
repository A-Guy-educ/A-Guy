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
 * Mandatory math formatting instructions injected into every chat prompt.
 * Ensures the LLM always uses LaTeX delimiters so the frontend can render math properly.
 */
const MATH_FORMATTING_INSTRUCTIONS = `## Math Formatting (CRITICAL)

Always use LaTeX delimiters for mathematical expressions:
- Inline math (within sentences): \\(...\\)
- Block/display math (standalone equations): \\[...\\]

IMPORTANT: Never use dollar signs ($) for math delimiters. Always use \\(...\\) for inline math and \\[...\\] for block math.

Never write math as plain text. Use proper LaTeX notation for fractions (\\frac{}{}), multiplication (\\cdot), square roots (\\sqrt{}), trigonometric functions (\\sin, \\cos, \\tan), Greek letters (\\alpha, \\pi), etc.

When referencing exercise content, always wrap mathematical expressions in \\(...\\) or \\[...\\] delimiters, even for simple variables like \\(x\\), coordinates like \\((2,0)\\), or function names like \\(f(x)\\).`

/**
 * Composes final system instructions for AI chat.
 *
 * Order (deterministic):
 * 1. All published system prompts (joined with separator)
 * 2. Teacher profile block (injected into system role, NOT stored in conversation)
 * 3. Lesson-specific resolved prompt
 * 4. Lesson context text injection (via buildLessonContextPrompt)
 *
 * @param systemPrompts - Array of system prompt templates (can be empty)
 * @param lessonPromptTemplate - Resolved lesson prompt template
 * @param lessonContextText - Optional lesson context to inject
 * @param teacherProfileBlock - Optional teacher profile block to inject
 * @returns Final composed system instructions string
 */
export function composeSystemInstructions(
  systemPrompts: string[],
  lessonPromptTemplate: string,
  lessonContextText?: string,
  teacherProfileBlock?: string,
): string {
  // Step 1: Join system prompts (if any)
  const systemPart =
    systemPrompts.length > 0
      ? systemPrompts.join(SYSTEM_PROMPT_SEPARATOR) + SYSTEM_PROMPT_SEPARATOR
      : ''

  // Step 2: Append teacher profile block (if provided)
  const withTeacherProfile = teacherProfileBlock
    ? systemPart + teacherProfileBlock + '\n\n'
    : systemPart

  // Step 3: Append lesson prompt
  const withLessonPrompt = withTeacherProfile + lessonPromptTemplate

  // Step 4: Append mandatory math formatting instructions
  const withMathFormatting = withLessonPrompt + '\n\n' + MATH_FORMATTING_INSTRUCTIONS

  // Step 5: Inject lesson context (reuse existing function)
  return buildLessonContextPrompt(withMathFormatting, lessonContextText)
}
