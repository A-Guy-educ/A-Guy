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
 * Mandatory image handling instructions injected into every chat prompt.
 * Ensures the LLM provides clear, actionable feedback when it cannot process an uploaded image.
 */
const IMAGE_HANDLING_INSTRUCTIONS = `## Image Handling

When a student uploads an image, analyze it carefully and provide clear, actionable feedback if there is a problem:

- **Unreadable / low quality**: If the image is blurry, too dark, too bright, or the text/numbers are not legible, tell the student exactly what is wrong (e.g., "The image is too blurry to read the numbers — please retake the photo with better focus and lighting").
- **Too small to read**: If the image is very small or the content is too tiny to make out, ask the student to upload a larger or higher-resolution version.
- **Not math or science related**: If the image does not contain a math or science exercise, equation, graph, diagram, or anything academically relevant, let the student know politely (e.g., "This image doesn't seem to contain a math or science problem. Please upload a photo of the exercise you need help with").
- **Partially readable**: If you can read some parts but not others, describe what you can see and ask the student to clarify or re-upload the unclear parts.
- **Supported formats**: Only JPEG, PNG, WebP images and PDF files are accepted. Maximum file size is 20 MB. Images must be at least 100×100 pixels. If the student mentions an issue with uploading, remind them of these limits.
- **Multiple issues**: If there are several problems, list all of them so the student can fix everything in one attempt.

Always be specific about the issue — never say just "there was an error" or "I can't read this". Explain what is wrong and what the student should do differently.`

/**
 * Composes final system instructions for AI chat.
 *
 * Order (deterministic):
 * 1. All published system prompts (joined with separator)
 * 2. Teacher profile block (injected into system role, NOT stored in conversation)
 * 3. Lesson-specific resolved prompt
 * 4. Mandatory math formatting instructions
 * 5. Mandatory image handling instructions
 * 6. Lesson context text injection (via buildLessonContextPrompt)
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

  // Step 5: Append mandatory image handling instructions
  const withImageHandling = withMathFormatting + '\n\n' + IMAGE_HANDLING_INSTRUCTIONS

  // Step 6: Inject lesson context (reuse existing function)
  return buildLessonContextPrompt(withImageHandling, lessonContextText)
}
