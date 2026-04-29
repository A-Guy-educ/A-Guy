/**
 * Structured (schema-mode) context extraction.
 *
 * Calls Gemini directly with responseMimeType='application/json' +
 * responseSchema so each PDF page returns a clean { exercises: [...] }
 * payload. Bypasses the unified Genkit adapter only because that adapter
 * does not surface responseSchema today; the same retry/timeout/circuit-
 * breaker primitives are applied here as in the rest of the LLM layer.
 */
import { z } from 'zod'
import { logger } from '@/infra/utils/logger/logger'
import { getCircuitBreaker } from '@/infra/llm/providers/shared/circuit-breaker'
import { withRetry } from '@/infra/llm/providers/shared/retry'
import { withTimeout } from '@/infra/llm/providers/shared/timeout'
import { ExtractedPageSchema, type ExtractedExercise } from './structured-extraction-schema'

const GEMINI_CONFIG = {
  modelName: 'gemini-2.5-flash',
  temperature: 0.1,
  maxOutputTokens: 32768,
  timeoutMs: 180_000,
  maxRetries: 2,
} as const

const circuitBreaker = getCircuitBreaker('context-extraction-gemini')

const SCHEMA_INSTRUCTION = [
  '',
  '═══════════════════════════════════════════════',
  'OUTPUT FORMAT — JSON SCHEMA MODE',
  '═══════════════════════════════════════════════',
  '',
  'IGNORE any earlier instruction telling you to output LaTeX as a complete document.',
  'You MUST return JSON matching the responseSchema. Specifically:',
  '',
  '- Return an object with a single key: "exercises" (an array).',
  '- Each item in the array represents ONE exercise visible on this page.',
  '- "number": the exercise number exactly as displayed in the source (preserve original numbering — if the source says 7, return 7).',
  '- "latex": the body of THAT exercise as compile-ready LaTeX. Do NOT include the document preamble, \\begin{document}, \\end{document}, outline comments, or any wrapper environment. Just the exercise body.',
  '- "solution": the worked solution for THAT exercise as compile-ready LaTeX (Hebrew explanations) if the source contains one. Otherwise null.',
  '- Apply ALL the math-mode, hierarchy, blank-preservation, and diagram rules from the earlier instructions to the LaTeX you place inside "latex" and "solution".',
  '- If the page is a cover/instructions/formula-sheet/blank page, return { "exercises": [] }.',
  '',
].join('\n')

export class GeminiSchemaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GeminiSchemaApiError'
  }
}

function isRetryableGeminiError(err: Error): boolean {
  if (err instanceof GeminiSchemaApiError) {
    return err.status >= 500 || err.status === 429
  }
  return err.name === 'TimeoutError' || err.message.includes('fetch failed')
}

/**
 * Convert a Zod schema to the OpenAPI 3.0 subset Gemini's responseSchema
 * accepts. Strips $schema and additionalProperties recursively.
 */
function zodToGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  return stripUnsupportedKeys(jsonSchema) as Record<string, unknown>
}

function stripUnsupportedKeys(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedKeys)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) {
      if (k === '$schema' || k === 'additionalProperties') continue
      out[k] = stripUnsupportedKeys(v)
    }
    return out
  }
  return node
}

/**
 * Re-escape unescaped LaTeX backslashes that appear inside JSON string
 * literals. Gemini occasionally emits raw \frac, \sqrt, \implies inside the
 * latex/solution fields without doubling the backslash, which breaks
 * JSON.parse. Crucially, we only rewrite content INSIDE quoted strings —
 * not the surrounding JSON structure — so unrelated backslash sequences
 * (e.g. inside a future numeric / boolean position) cannot be over-escaped.
 *
 * The matcher walks string-literal regions delimited by unescaped quotes,
 * tracking escape state so an embedded \" doesn't end the string. Within a
 * region, any backslash NOT followed by one of "\\/bfnrtu (the JSON-valid
 * escape leads, including the unicode escape u — its 4 hex digits are
 * already valid characters and need no rewriting) gets doubled.
 */
export function fixLatexEscapes(text: string): string {
  let out = ''
  let inString = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (!inString) {
      out += ch
      if (ch === '"') inString = true
      i++
      continue
    }
    // Inside a JSON string literal.
    if (ch === '"') {
      out += ch
      inString = false
      i++
      continue
    }
    if (ch === '\\') {
      const next = text[i + 1] ?? ''
      if (next === '' || /[^"\\/bfnrtu]/.test(next)) {
        // Lone backslash before a non-escape char → double it.
        out += '\\\\'
        i++
      } else {
        // Valid JSON escape sequence — copy both chars verbatim.
        out += ch + next
        i += 2
      }
      continue
    }
    out += ch
    i++
  }
  return out
}

export function parseSchemaResponse(responseText: string): unknown {
  const cleaned = responseText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return JSON.parse(fixLatexEscapes(cleaned))
  }
}

async function callGeminiWithSchema(args: {
  apiKey: string
  prompt: string
  pdfBase64: string
}): Promise<string> {
  const schemaForGemini = zodToGeminiSchema(ExtractedPageSchema)

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.modelName}:generateContent?key=${args.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: args.pdfBase64 } },
              { text: args.prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: schemaForGemini,
        },
      }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    logger.error(
      { status: res.status, body: body.slice(0, 500) },
      'Context-extraction Gemini API error',
    )
    throw new GeminiSchemaApiError(res.status, `Gemini API returned ${res.status}`)
  }

  const json = await res.json()
  const text =
    json.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      ?.map((p: { text: string }) => p.text)
      ?.join('') || ''
  return text
}

export interface ExtractPageResult {
  pageIndex: number
  exercises: ExtractedExercise[]
  warning?: string
}

/**
 * Extract structured exercises from a single PDF page.
 * The provided prompt is concatenated with a JSON-schema instruction so the
 * existing admin-managed context_extractor prompts continue to work — they
 * supply the LaTeX content rules; we override only the output container.
 */
export async function extractStructuredExercisesFromPage(args: {
  apiKey: string
  promptTemplate: string
  pageBuffer: Buffer
  pageIndex: number
}): Promise<ExtractPageResult> {
  const fullPrompt = `${args.promptTemplate}\n${SCHEMA_INSTRUCTION}`

  const responseText = await circuitBreaker.execute(() =>
    withRetry(
      () =>
        withTimeout(
          () =>
            callGeminiWithSchema({
              apiKey: args.apiKey,
              prompt: fullPrompt,
              pdfBase64: args.pageBuffer.toString('base64'),
            }),
          { timeoutMs: GEMINI_CONFIG.timeoutMs, message: 'Gemini context-extraction timed out' },
        ),
      {
        maxRetries: GEMINI_CONFIG.maxRetries,
        isRetryable: isRetryableGeminiError,
        logPrefix: '[ContextExtractionSchema]',
      },
    ),
  )

  if (!responseText.trim()) {
    return { pageIndex: args.pageIndex, exercises: [], warning: 'Empty response' }
  }

  let parsed: unknown
  try {
    parsed = parseSchemaResponse(responseText)
  } catch (err) {
    return {
      pageIndex: args.pageIndex,
      exercises: [],
      warning: `Failed to parse JSON: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }

  const validated = ExtractedPageSchema.safeParse(parsed)
  if (!validated.success) {
    return {
      pageIndex: args.pageIndex,
      exercises: [],
      warning: `Schema validation failed: ${validated.error.message.slice(0, 200)}`,
    }
  }

  return { pageIndex: args.pageIndex, exercises: validated.data.exercises }
}

/**
 * Merge per-page exercise arrays into a single ordered list.
 *
 * Page-by-page extraction has no shared numbering context — page 2 may
 * label its first exercise "1" because, viewed in isolation, it looks
 * like the start of a document. We:
 *
 *   1. Concatenate exercises in page order.
 *   2. Detect duplicate numbers across pages.
 *   3. If duplicates exist, renumber sequentially from 1 by overall position.
 *      Otherwise keep the LLM-supplied numbers — they are usually correct
 *      when source pages carry their own \setcounter context.
 */
export function mergeExercisesAcrossPages(pageResults: ExtractPageResult[]): ExtractedExercise[] {
  const ordered = [...pageResults].sort((a, b) => a.pageIndex - b.pageIndex)
  const flat: ExtractedExercise[] = []
  for (const page of ordered) {
    for (const ex of page.exercises) {
      flat.push(ex)
    }
  }

  if (flat.length === 0) return []

  const numbers = new Set<number>()
  let hasConflict = false
  for (const ex of flat) {
    if (numbers.has(ex.number)) {
      hasConflict = true
      break
    }
    numbers.add(ex.number)
  }

  if (!hasConflict) return flat

  return flat.map((ex, idx) => ({ ...ex, number: idx + 1 }))
}

/**
 * Render a structured exercise list back into the same kind of LaTeX text
 * the legacy context-exercise-parser already understands. This lets the
 * existing ContextExerciseViewer keep working unchanged in this PR — it
 * fetches `text` from ContextExtractions and parses with parseContextText,
 * which matches the \textbf{תרגיל N} / \section*{פתרון תרגיל N} markers
 * we emit here. The structured `exercises` array is what create-context-
 * exercises actually consumes; this rendered text is a compatibility view.
 */
/** Placeholder used in the rendered text when an exercise has no solution.
 * Non-empty so the legacy parser's "phantom exercise" filter (which drops
 * exercises with no matching solution when others do have one) keeps every
 * exercise visible in the admin preview. */
const NO_SOLUTION_PLACEHOLDER = 'הפתרון לא נכלל בחומר המקור.'

export function renderExercisesAsLatexText(exercises: ExtractedExercise[]): string {
  if (exercises.length === 0) return ''

  const parts: string[] = []

  for (const ex of exercises) {
    parts.push(`\\textbf{תרגיל ${ex.number}}`)
    parts.push('')
    parts.push(ex.latex.trim())
    parts.push('')
  }

  parts.push('')
  parts.push('\\section*{פתרונות}')
  parts.push('')
  for (const ex of exercises) {
    parts.push(`\\section*{פתרון תרגיל ${ex.number}}`)
    parts.push('')
    const solution = ex.solution !== null && ex.solution.trim() ? ex.solution.trim() : null
    parts.push(solution ?? NO_SOLUTION_PLACEHOLDER)
    parts.push('')
  }

  return parts.join('\n').trim() + '\n'
}
