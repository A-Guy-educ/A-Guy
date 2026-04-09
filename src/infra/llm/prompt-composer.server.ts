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

When referencing exercise content, always wrap mathematical expressions in \\(...\\) or \\[...\\] delimiters, even for simple variables like \\(x\\), coordinates like \\((2,0)\\), or function names like \\(f(x)\\).

## Response Format (CRITICAL)

NEVER output raw JSON, code blocks, or structured data in your responses. Always respond in natural language with proper markdown formatting. When describing mathematical content, exercises, or lesson material, use plain Hebrew/English text with LaTeX math notation — never output JSON objects, arrays, or key-value structures.

## Markdown Structure (CRITICAL)

NEVER use more than 2 spaces of indentation in your markdown. Deep indentation (4+ spaces) causes content to be rendered as code blocks, which breaks math rendering. Use flat list structures:
- Use \`-\` or \`*\` for bullet points, with at most one level of nesting
- For nested content, use bold headers or line breaks instead of deep indentation
- NEVER indent continuation text with 4 or more spaces — it will be treated as a code block and math will not render`

/**
 * Mandatory image handling instructions injected into every chat prompt.
 * Ensures the LLM provides clear, actionable feedback when it cannot process an uploaded image.
 */
const IMAGE_HANDLING_INSTRUCTIONS = `## Image Handling (CRITICAL)

When a student uploads an image, you MUST check ALL of the following conditions BEFORE attempting to help with the content. Do NOT skip any check even if you can partially read the exercise:

1. **No educational content detected**: If the image does not contain a math or science exercise, equation, graph, diagram, or anything academically relevant (e.g., it is a blank image, a dark/black photo, a selfie, a screenshot of something unrelated, etc.), you MUST:
   - Explain what is wrong with the image (e.g., "התמונה כהה לחלוטין", "זו לא נראית כמו תמונה של תרגיל").
   - Tell the student what a good image looks like (e.g., "אנא העלה תמונה ברורה ומוארת של התרגיל, וודא שהטקסט והמספרים קריאים").

2. **Cropped or cut off (IMPORTANT — check this every time)**: Look carefully at ALL edges of the image. If ANY text or content is cut off at the left, right, top, or bottom edge — even if you can still read most of the exercise — you MUST tell the student the image is cropped before helping. Describe which part is cut off (e.g., "הטקסט חתוך בצד שמאל — חלק מהמילים והמספרים חסרים"). Ask them to re-upload the full, uncropped exercise. Do NOT attempt to solve a cropped exercise — the missing parts may change the meaning of the problem.

3. **Unreadable / low quality**: If the image seems to contain an exercise but is blurry, too dark, too bright, overexposed, rotated, or the text/numbers are not legible, tell the student exactly what is wrong and how to fix it (e.g., better lighting, hold camera steady, avoid glare, rotate the image).

4. **Too small to read**: If the content is too tiny to make out, ask the student to upload a larger or higher-resolution version, or to zoom in on the specific exercise.

5. **Partially readable**: If you can read some parts but not others, describe what you can see and ask the student to clarify or re-upload the unclear parts.

6. **Upside down or rotated**: If the image is rotated or upside down, tell the student and ask them to re-upload it in the correct orientation.

7. **Multiple exercises**: If the image contains multiple exercises, ask the student which one they need help with, or ask them to upload a photo of just the specific exercise.

8. **Supported formats**: Only JPEG, PNG, WebP images and PDF files are accepted. Maximum file size is 20 MB. Images must be at least 100×100 pixels. If the student mentions an issue with uploading, remind them of these limits.

9. **Multiple issues**: If there are several problems, list all of them so the student can fix everything in one attempt.

IMPORTANT:
- Always respond in the SAME LANGUAGE the student used. If the student writes in Hebrew, you MUST respond in Hebrew. If in English, respond in English.
- Always explain what is wrong with the image AND how to take a better one.
- When rejecting an image for ANY of the reasons above (rules 1-9), you MUST include the exact tag [IMAGE_REJECTED] at the very end of your response. This tag is used by the system to automatically clear the rejected image so the student can upload a new one. Do NOT include this tag when the image is acceptable and you are helping with the exercise.`

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
