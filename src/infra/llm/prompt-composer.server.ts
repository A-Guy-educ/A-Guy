/**
 * Composes final system instructions for AI chat
 *
 * @fileType ai-utility
 * @domain chat
 * @pattern server-only
 */

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
- When rejecting an image for ANY of the reasons above (rules 1-9), you MUST include the exact tag [IMAGE_REJECTED] at the very end of your response. This tag is a rejection signal used by the system; the tag itself is stripped from what the student sees. Do NOT include this tag when the image is acceptable and you are helping with the exercise.`

/**
 * Composes final system instructions for AI chat.
 *
 * Order (deterministic):
 * 1. All published system prompts (joined with separator)
 * 2. Teacher profile block (injected into system role, NOT stored in conversation)
 * 3. Lesson-specific resolved prompt
 * 4. Lesson/exercise context block (fallback metadata about what the student is on)
 * 5. Course context text (if provided)
 * 6. Lesson context text (AI-injected lesson content, if provided)
 * 7. Lesson exercises (structured content blocks, if provided)
 * 8. Mandatory math formatting instructions
 * 9. Image handling instructions — INJECTED ONLY when an image is attached
 *    (see hasImageAttached). When no image is in the request these rules
 *    confuse the model into refusing text-only chat with "please upload
 *    an image" responses, so we skip them.
 *
 * @param systemPrompts - Array of system prompt templates (can be empty)
 * @param lessonPromptTemplate - Resolved lesson prompt template
 * @param teacherProfileBlock - Optional teacher profile block to inject
 * @param lessonContextBlock - Optional fallback metadata about the current lesson/exercise (from origin/dev buildLessonContextBlock)
 * @param lessonContextText - Optional AI context text for the lesson (lessonContextText or description)
 * @param courseContextText - Optional AI context text for the course
 * @param exercises - Optional exercises associated with the lesson
 * @param hasImageAttached - When true, append IMAGE_HANDLING_INSTRUCTIONS. Defaults to true for back-compat with callers that don't (yet) plumb this through.
 * @returns Final composed system instructions string
 */
export function composeSystemInstructions(
  systemPrompts: string[],
  lessonPromptTemplate: string,
  teacherProfileBlock?: string,
  lessonContextBlock?: string,
  lessonContextText?: string,
  courseContextText?: string,
  exercises?: Array<{ id: string; title?: string; content: unknown }>,
  hasImageAttached: boolean = true,
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

  // Step 4: Append lesson/exercise context block (from buildLessonContextBlock — fallback metadata)
  const withLessonContextBlock = lessonContextBlock
    ? withLessonPrompt + '\n\n' + lessonContextBlock
    : withLessonPrompt

  // Step 5: Append course context text (if provided)
  const withCourseContext = courseContextText
    ? withLessonContextBlock + '\n\n## Course Context\n' + courseContextText
    : withLessonContextBlock

  // Step 6: Append lesson context text (if provided)
  const withLessonContext =
    lessonContextText && lessonContextText.trim().length > 0
      ? withCourseContext + '\n\n## Lesson Content\n' + lessonContextText.trim()
      : withCourseContext

  // Step 7: Append lesson exercises (if provided), with size budget.
  // Audit F4: previously emitted full content of every exercise — for a
  // 31-exercise lesson that produced a ~14 KB system prompt that diluted
  // the model's attention. Now: per-exercise content is truncated to
  // EXERCISE_CONTENT_BUDGET, and the section as a whole stops after
  // EXERCISES_SECTION_BUDGET with a tail noting how many exercises remain.
  let withExercises = withLessonContext
  if (exercises && exercises.length > 0) {
    withExercises = withLessonContext + buildExercisesSection(exercises)
  }

  // Step 8: Append mandatory math formatting instructions
  const withMathFormatting = withExercises + '\n\n' + MATH_FORMATTING_INSTRUCTIONS

  // Step 9: Append image handling instructions ONLY when an image is attached.
  // Otherwise these rules dominate the prompt and Gemini falls back to
  // "please upload an image" even on text-only chats with full lesson context.
  return hasImageAttached
    ? withMathFormatting + '\n\n' + IMAGE_HANDLING_INSTRUCTIONS
    : withMathFormatting
}

/**
 * Per-exercise body is truncated to this many characters to keep the
 * "## Lesson Exercises" section bounded for lessons with many exercises
 * or long bodies. Title is always shown — only the body is truncated.
 */
const EXERCISE_CONTENT_BUDGET = 400

/**
 * Total budget for the exercises section. Once exceeded, remaining
 * exercises are listed by title only and a "...and N more" tail is added.
 */
const EXERCISES_SECTION_BUDGET = 4000

/**
 * Build the exercises section of the system prompt with size budgeting.
 * Title is always included; per-exercise body is truncated to
 * EXERCISE_CONTENT_BUDGET; total emitted text is capped at
 * EXERCISES_SECTION_BUDGET with a tail noting how many remain.
 */
function buildExercisesSection(
  exercises: Array<{ id: string; title?: string; content: unknown }>,
): string {
  const header =
    '\n\n## Lesson Exercises\nThe following exercises are available in this lesson. You can answer questions about them:\n\n'

  const lines: string[] = []
  let used = 0
  let remaining = exercises.length

  for (let idx = 0; idx < exercises.length; idx++) {
    const exercise = exercises[idx]
    const title = exercise.title ? `**${exercise.title}**` : `Exercise ${idx + 1}`
    const fullContent = formatExerciseContent(exercise.content)
    const truncatedContent =
      fullContent.length > EXERCISE_CONTENT_BUDGET
        ? fullContent.slice(0, EXERCISE_CONTENT_BUDGET) + '…(truncated)'
        : fullContent

    const candidate = `${idx + 1}. ${title}\n${truncatedContent}`

    // If adding this entry would blow the budget, switch to title-only mode
    // for the rest and break.
    if (used + candidate.length > EXERCISES_SECTION_BUDGET) {
      const remainingTitles = exercises.slice(idx).map((e, i) => {
        const t = e.title ? `**${e.title}**` : `Exercise ${idx + i + 1}`
        return `${idx + i + 1}. ${t}`
      })
      lines.push(...remainingTitles)
      remaining = 0
      break
    }

    lines.push(candidate)
    used += candidate.length + 2 // +2 for the joining \n\n
    remaining--
  }

  let body = lines.join('\n\n')
  if (remaining > 0) {
    body += `\n\n…and ${remaining} more exercise${remaining === 1 ? '' : 's'} in this lesson (titles only above to fit the prompt budget).`
  }
  return header + body
}

/**
 * Format exercise content blocks into readable text for the system prompt.
 * Extracts key information from content blocks to give the LLM context.
 */
function formatExerciseContent(content: unknown): string {
  if (!content || typeof content !== 'object') return '(No content)'

  const data = content as { blocks?: unknown[] }
  if (!Array.isArray(data.blocks) || data.blocks.length === 0) return '(No content)'

  const parts: string[] = []

  for (const block of data.blocks) {
    if (!block || typeof block !== 'object') continue

    const b = block as { type?: string; value?: string; prompt?: unknown }

    if (b.type === 'latex') {
      const latexBlock = b as { type: 'latex'; latex: string }
      parts.push(`[LaTeX]: ${latexBlock.latex}`)
    } else if (b.type === 'rich_text') {
      const rtBlock = b as { type: 'rich_text'; value: string }
      if (rtBlock.value) parts.push(rtBlock.value)
    } else if (b.type === 'question_select') {
      const qBlock = b as { type: 'question_select'; prompt?: { value?: string } }
      const prompt =
        qBlock.prompt && typeof qBlock.prompt === 'object'
          ? (qBlock.prompt as { value?: string }).value
          : undefined
      if (prompt) parts.push(`[Question]: ${prompt}`)
    } else if (b.type === 'question_free_response') {
      const qBlock = b as { type: 'question_free_response'; prompt?: { value?: string } }
      const prompt =
        qBlock.prompt && typeof qBlock.prompt === 'object'
          ? (qBlock.prompt as { value?: string }).value
          : undefined
      if (prompt) parts.push(`[Free Response Question]: ${prompt}`)
    } else if (b.type === 'question_table') {
      const qBlock = b as { type: 'question_table'; prompt?: { value?: string } }
      const prompt =
        qBlock.prompt && typeof qBlock.prompt === 'object'
          ? (qBlock.prompt as { value?: string }).value
          : undefined
      if (prompt) parts.push(`[Table Question]: ${prompt}`)
    } else if (b.type === 'question_matching') {
      const qBlock = b as { type: 'question_matching'; prompt?: { value?: string } }
      const prompt =
        qBlock.prompt && typeof qBlock.prompt === 'object'
          ? (qBlock.prompt as { value?: string }).value
          : undefined
      if (prompt) parts.push(`[Matching Question]: ${prompt}`)
    } else if (b.type === 'html') {
      const htmlBlock = b as { type: 'html'; html?: string }
      if (htmlBlock.html) {
        // Strip HTML tags for a cleaner text representation
        const text = htmlBlock.html
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text) parts.push(`[Content]: ${text}`)
      }
    } else if (b.type === 'svg') {
      const svgBlock = b as { type: 'svg'; caption?: { value?: string } }
      const caption =
        svgBlock.caption && typeof svgBlock.caption === 'object'
          ? (svgBlock.caption as { value?: string }).value
          : undefined
      if (caption) parts.push(`[SVG Diagram]: ${caption}`)
    }
    // Skip geometry, axis, multi_axis blocks (visual content not easily represented in text)
  }

  return parts.length > 0 ? parts.join('\n') : '(No extractable text content)'
}
