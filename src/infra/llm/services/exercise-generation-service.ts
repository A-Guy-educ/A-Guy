/**
 * Exercise Generation Service
 *
 * Generates new exercises based on a user-provided prompt.
 * Called by the exercise generation orchestrator.
 *
 * Service signature: generateExercises({ prompt, difficultyLevel }): Promise<GenerateExerciseResult>
 *
 * Two-pass approach:
 * - Pass 1 (creative): generates exercise question/hint/phrasing at temp 0.7
 * - Pass 2 (deterministic): re-derives solution at temp 0.0
 *
 * Rate limit errors are surfaced to the caller for resumable handling.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../models'

import { getModelRegistryEntry, getProviderModelName } from '../models'
import { LLMProviderType } from '../providers/types'
import { logger } from '@/infra/utils/logger'
import { VariationGenerationError } from '../errors'
import type { GenerationDifficultyLevel } from '@/server/payload/collections/ExerciseGenerations'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import { withTimeout as withSharedTimeout } from '@/infra/utils/with-timeout'
import { SolutionDerivationOutputSchema } from '../schemas/lesson-duplication-output'

/**
 * Gemini-compatible JSON Schema type (subset used by exercise generation).
 */
type GeminiJsonSchema =
  | { type: 'string' | 'number' | 'integer' | 'boolean' }
  | { type: 'array'; items: GeminiJsonSchema }
  | { type: 'object'; properties: Record<string, GeminiJsonSchema>; required?: string[] }
  | { anyOf: GeminiJsonSchema[] }

/**
 * Model used for both passes.
 */
const GENERATION_MODEL_VERSION = 'gemini-3.1-pro-preview'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TokensUsed {
  inputTokens: number
  outputTokens: number
}

export interface GenerateExerciseInput {
  prompt: string
  difficultyLevel: GenerationDifficultyLevel
  exerciseIndex: number
  totalExercises: number
}

export interface GenerateExerciseResult {
  blocks: ContentBlock[]
  tokensUsed: TokensUsed
}

/**
 * Per-LLM-call timeout.
 */
export const LLM_CALL_TIMEOUT_MS = 300_000

/** Convenience wrapper that pins the default timeout to LLM_CALL_TIMEOUT_MS. */
function withTimeoutWrapper<T>(promise: Promise<T>, stage: string): Promise<T> {
  return withSharedTimeout(promise, stage, LLM_CALL_TIMEOUT_MS)
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Loading
// ─────────────────────────────────────────────────────────────────────────────

function loadGenerationPrompt(difficulty: GenerationDifficultyLevel): string {
  const filename = `exercise-generation-${difficulty}-prompt.md`
  const candidates = [
    join(process.cwd(), 'src/infra/llm/prompts/exercise-generation', filename),
    join(process.cwd(), 'infra/llm/prompts/exercise-generation', filename),
  ]
  for (const candidate of candidates) {
    try {
      const text = readFileSync(candidate, 'utf-8')
      if (text.trim().length > 0) return text
    } catch {
      // try next candidate
    }
  }
  // Fallback prompt if file not found
  logger.warn(
    { difficulty, candidates },
    '[ExerciseGeneration] Prompt file not found, using fallback',
  )
  return getFallbackPrompt(difficulty)
}

function getFallbackPrompt(difficulty: GenerationDifficultyLevel): string {
  const difficultyInstructions = {
    easy: 'Use simple concepts, straightforward calculations, and minimal multi-step reasoning.',
    medium: 'Use moderate complexity, multi-step problems, and standard mathematical notation.',
    hard: 'Use advanced concepts, complex multi-step reasoning, and challenging problem structures.',
  }
  return `You are an expert math educator. Generate a high-quality math exercise.

Generate exactly ONE exercise at ${difficulty} difficulty level.
${difficultyInstructions[difficulty]}

The exercise should be:
- Clear and unambiguous
- Mathematically correct
- Suitable for the difficulty level
- Self-contained (no external references needed)

Return a JSON object with a 'blocks' array representing the exercise structure.
Each block should have an 'id' field (unique string), 'type' field, and type-specific fields.

For question blocks (question_select, question_free_response, etc.), include:
- prompt: the question text (rich_text format: { "type": "rich_text", "format": "md-math-v1", "value": "...", "mediaIds": [] })
- hint: a helpful hint (optional but recommended)
- solution: brief solution explanation
- fullSolution: detailed step-by-step solution
- answer: the correct answer in the appropriate format

Return ONLY the JSON. No markdown fences, no explanation.`
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build output JSON schema for exercise generation pass 1.
 * Since we're generating a new exercise (not varying an existing one),
 * we use a schema that describes the expected block structure.
 */
function buildExerciseOutputSchema(): GeminiJsonSchema {
  // This schema accepts a blocks array with any block structure.
  // Validation of the actual block types happens via Payload's Zod schemas
  // when the exercise is created.
  return {
    type: 'object',
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
          },
          required: ['id', 'type'],
        },
      },
    },
    required: ['blocks'],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a single exercise based on the provided prompt.
 *
 * Two-pass approach:
 * - Pass 1 (creative): generates question/hint/phrasing at temp 0.7
 * - Pass 2 (deterministic): re-derives solution at temp 0.0
 *
 * On invalid JSON or schema mismatch: retries once with the same prompt.
 * If the retry also fails, throws VariationGenerationError — the caller
 * (orchestrator) catches and records it as a failure without aborting the run.
 */
export async function generateExercise(
  input: GenerateExerciseInput,
  payload: Payload,
): Promise<GenerateExerciseResult> {
  const { prompt, difficultyLevel, exerciseIndex, totalExercises } = input
  const startTime = Date.now()

  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Pass 1 — Creative (question + hint + phrasing)
  const creativePrompt = loadGenerationPrompt(difficultyLevel)
  const creativeUserPrompt = buildUserPrompt(prompt, exerciseIndex, totalExercises)

  let creativeJsonRetried = false
  let creativeRateLimitRetries = 0
  let creativeBreakerRetries = 0
  let pass1Output: { blocks: ContentBlock[] } | null = null

  const maxAttempts = 1 + 1 + (RATE_LIMIT_MAX_ATTEMPTS - 1) + CIRCUIT_BREAKER_MAX_ATTEMPTS
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
      const adapter = await createGenkitUnifiedAdapter(payload)
      const creativeConfig = resolveModelConfig('LESSON_DUPLICATION_VARIATION_CREATIVE')

      const result = await withTimeoutWrapper(
        adapter.generateChatCompletion(
          {
            system: creativePrompt,
            messages: [{ role: 'user', content: creativeUserPrompt }],
            model: creativeConfig,
            acknowledgment: `Generating exercise ${exerciseIndex + 1} of ${totalExercises}`,
            outputJsonSchema: buildExerciseOutputSchema(),
            modelVersion: GENERATION_MODEL_VERSION,
          },
          payload,
        ),
        'pass-1-creative',
      )

      pass1Output = extractPass1Output(result)

      if (result.usage) {
        totalInputTokens += result.usage.inputTokens
        totalOutputTokens += result.usage.outputTokens
      }

      break
    } catch (error) {
      const breakerCooldown = getCircuitBreakerCooldownMs(error)
      if (breakerCooldown !== null && creativeBreakerRetries < CIRCUIT_BREAKER_MAX_ATTEMPTS) {
        logger.warn(
          { difficultyLevel, exerciseIndex, cooldownMs: breakerCooldown },
          '[ExerciseGeneration] Pass 1 hit circuit breaker, waiting for cooldown',
        )
        creativeBreakerRetries++
        await sleep(breakerCooldown)
        continue
      }
      if (isRateLimitError(error) && creativeRateLimitRetries < RATE_LIMIT_MAX_ATTEMPTS - 1) {
        const backoff = RATE_LIMIT_BACKOFFS_MS[creativeRateLimitRetries] ?? 12_000
        logger.warn(
          { difficultyLevel, exerciseIndex, attempt: creativeRateLimitRetries + 1, backoff },
          '[ExerciseGeneration] Pass 1 rate-limited, backing off',
        )
        creativeRateLimitRetries++
        await sleep(backoff)
        continue
      }
      if (isJsonParseError(error) && !creativeJsonRetried) {
        creativeJsonRetried = true
        continue
      }
      const latencyMs = Date.now() - startTime
      logger.error(
        { latencyMs, difficultyLevel, exerciseIndex, err: error },
        '[ExerciseGeneration] Pass 1 failed (non-retryable or retries exhausted)',
      )
      throw new VariationGenerationError(
        `exercise-${exerciseIndex}`,
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  if (!pass1Output) {
    throw new VariationGenerationError(
      `exercise-${exerciseIndex}`,
      'Unexpected: pass 1 produced no output',
    )
  }

  // Pass 2 — Deterministic (solution derivation)
  const derivationPrompt = buildSolutionDerivationPrompt(pass1Output.blocks)
  let pass2Patch: Pass2Patch | null = null

  let pass2JsonRetried = false
  let pass2RateLimitRetries = 0
  let pass2BreakerRetries = 0
  const maxPass2Attempts = 1 + 1 + (RATE_LIMIT_MAX_ATTEMPTS - 1) + CIRCUIT_BREAKER_MAX_ATTEMPTS

  for (let attempt = 0; attempt < maxPass2Attempts; attempt++) {
    try {
      const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
      const adapter = await createGenkitUnifiedAdapter(payload)
      const deterministicConfig = resolveModelConfig('LESSON_DUPLICATION_VARIATION_DETERMINISTIC')

      const result = await withTimeoutWrapper(
        adapter.generateChatCompletion(
          {
            system: derivationPrompt,
            messages: [{ role: 'user', content: '' }],
            model: deterministicConfig,
            acknowledgment: 'Deriving solution for exercise',
            outputSchema: SolutionDerivationOutputSchema,
            modelVersion: GENERATION_MODEL_VERSION,
          },
          payload,
        ),
        'pass-2-deterministic',
      )

      pass2Patch = extractPass2Patch(result)

      if (result.usage) {
        totalInputTokens += result.usage.inputTokens
        totalOutputTokens += result.usage.outputTokens
      }

      break
    } catch (error) {
      const breakerCooldown = getCircuitBreakerCooldownMs(error)
      if (breakerCooldown !== null && pass2BreakerRetries < CIRCUIT_BREAKER_MAX_ATTEMPTS) {
        logger.warn(
          { difficultyLevel, exerciseIndex, cooldownMs: breakerCooldown },
          '[ExerciseGeneration] Pass 2 hit circuit breaker, waiting for cooldown',
        )
        pass2BreakerRetries++
        await sleep(breakerCooldown)
        continue
      }
      if (isRateLimitError(error) && pass2RateLimitRetries < RATE_LIMIT_MAX_ATTEMPTS - 1) {
        const backoff = RATE_LIMIT_BACKOFFS_MS[pass2RateLimitRetries] ?? 12_000
        logger.warn(
          { difficultyLevel, exerciseIndex, attempt: pass2RateLimitRetries + 1, backoff },
          '[ExerciseGeneration] Pass 2 rate-limited, backing off',
        )
        pass2RateLimitRetries++
        await sleep(backoff)
        continue
      }
      if (isJsonParseError(error) && !pass2JsonRetried) {
        pass2JsonRetried = true
        continue
      }
      const latencyMs = Date.now() - startTime
      logger.error(
        { latencyMs, difficultyLevel, exerciseIndex, err: error },
        '[ExerciseGeneration] Pass 2 failed (non-retryable or retries exhausted)',
      )
      throw new VariationGenerationError(
        `exercise-${exerciseIndex}`,
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  if (!pass2Patch) {
    throw new VariationGenerationError(
      `exercise-${exerciseIndex}`,
      'Unexpected: pass 2 produced no output',
    )
  }

  // Merge: pass-1 blocks (question/hint) + pass-2 solution fields
  const mergedBlocks = mergePassOutputs(pass1Output.blocks, pass2Patch)

  // Sanitize AI output
  const cleanedBlocks = sanitizeAiBlocks(mergedBlocks)

  const latencyMs = Date.now() - startTime
  logger.info(
    { latencyMs, difficultyLevel, exerciseIndex },
    '[ExerciseGeneration] Two-pass complete',
  )

  return {
    blocks: cleanedBlocks,
    tokensUsed: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(prompt: string, exerciseIndex: number, totalExercises: number): string {
  return `Generate exercise ${exerciseIndex + 1} of ${totalExercises}.

User request:
${prompt}

Generate a math exercise that matches the user's request. Include:
- A clear question/prompt
- Appropriate hint (if helpful)
- A brief solution
- A detailed step-by-step fullSolution
- The correct answer in the appropriate format

Return ONLY the JSON with a 'blocks' array. No markdown fences, no explanation.`
}

function buildSolutionDerivationPrompt(blocks: ContentBlock[]): string {
  return `You are a strict mathematical derivation assistant. Given a newly generated exercise question,
fill in the complete solution fields.

Exercise structure:
${JSON.stringify(blocks, null, 2)}

Task:
For each question block in the exercise:
1. Solve the question independently
2. Write the complete step-by-step solution in fullSolution (show every step)
3. Write a brief solution in solution
4. Fill in the answer field with the correct answer

Return ONLY a JSON object with a 'blocks' array containing the blocks with solution fields filled in.
No markdown fences, no explanation.

rich_text format: { "type": "rich_text", "format": "md-math-v1", "value": "...", "mediaIds": [] }`
}

interface Pass2Patch {
  blocks?: ContentBlock[]
}

/**
 * Adapter response from `generateChatCompletion`.
 */
interface AdapterResult {
  text: string
  output?: unknown
}

function extractPass1Output(result: AdapterResult): { blocks: ContentBlock[] } | null {
  if (result.output && typeof result.output === 'object') {
    const candidate = result.output as { blocks?: ContentBlock[] }
    if (candidate.blocks && Array.isArray(candidate.blocks)) {
      return candidate as { blocks: ContentBlock[] }
    }
  }
  return parseVariationResponseFromText(result.text)
}

function extractPass2Patch(result: AdapterResult): Pass2Patch | null {
  if (result.output && typeof result.output === 'object') {
    return result.output as Pass2Patch
  }
  return parseSolutionDerivationResponseFromText(result.text)
}

function parseVariationResponseFromText(text: string): { blocks: ContentBlock[] } | null {
  try {
    const cleaned = stripCodeFences(text)
    const parsed = JSON.parse(cleaned)
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      return parsed as { blocks: ContentBlock[] }
    }
    // If the response is an array directly
    if (Array.isArray(parsed)) {
      return { blocks: parsed as ContentBlock[] }
    }
    throw new SyntaxError('Response missing required blocks field')
  } catch {
    return null
  }
}

function parseSolutionDerivationResponseFromText(text: string): Pass2Patch | null {
  try {
    const cleaned = stripCodeFences(text)
    return JSON.parse(cleaned) as Pass2Patch
  } catch {
    return null
  }
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
}

function mergePassOutputs(pass1Blocks: ContentBlock[], pass2Patch: Pass2Patch): ContentBlock[] {
  if (!pass2Patch.blocks || !Array.isArray(pass2Patch.blocks)) {
    return pass1Blocks
  }

  // Merge pass-2 solution fields into pass-1 blocks
  const pass2BlocksMap = new Map<string, ContentBlock>()
  for (const block of pass2Patch.blocks) {
    if ('id' in block && typeof block.id === 'string') {
      pass2BlocksMap.set(block.id, block)
    }
  }

  return pass1Blocks.map((block) => {
    if (!('id' in block) || typeof block.id !== 'string') {
      return block
    }
    const patch = pass2BlocksMap.get(block.id)
    if (!patch) return block

    // Merge solution fields
    const result: Record<string, unknown> = { ...block }
    if ('solution' in patch && patch.solution !== undefined) {
      result.solution = patch.solution
    }
    if ('fullSolution' in patch && patch.fullSolution !== undefined) {
      result.fullSolution = patch.fullSolution
    }
    if ('answer' in patch && patch.answer !== undefined) {
      result.answer = patch.answer
    }
    return result as ContentBlock
  })
}

function sanitizeAiBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block
    const b = block as Record<string, unknown>
    const type = typeof b.type === 'string' ? b.type : ''

    // Strip `answer.kind` on question types where it's not in the schema
    if (
      type.startsWith('question_') &&
      type !== 'question_geometry' &&
      type !== 'question_axis' &&
      b.answer &&
      typeof b.answer === 'object'
    ) {
      const ans = b.answer as Record<string, unknown>
      if ('Kind' in ans) {
        delete ans.Kind
      }
    }

    return b as ContentBlock
  })
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
    modelKey,
  }
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError || (error instanceof Error && error.message.includes('JSON'))
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code = (error as { code?: string }).code
  if (code === 'RATE_LIMIT_ERROR') return true

  const msg = error.message.toLowerCase()
  return (
    /\brate[\s_-]?limit(?:\s+exceeded)?\b/.test(msg) ||
    /\bresource[\s_-]?exhausted\b/.test(msg) ||
    /\bquota\s+exceeded\b/.test(msg) ||
    /\btoo\s+many\s+requests\b/.test(msg) ||
    /\b(?:status|code|http)\s*[:=]?\s*429\b/.test(msg)
  )
}

function getCircuitBreakerCooldownMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  if (!/circuit breaker is open/i.test(error.message)) return null
  const m = error.message.match(/try again in\s+(\d+)\s*s/i)
  const secs = m ? parseInt(m[1], 10) : 60
  return secs * 1000 + 1_000
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const RATE_LIMIT_MAX_ATTEMPTS = 4
const RATE_LIMIT_BACKOFFS_MS = [2_000, 5_000, 12_000]
const CIRCUIT_BREAKER_MAX_ATTEMPTS = 2
