/**
 * Lesson Duplication Variation Service
 *
 * Generates variations for a single exercise at a time with light, medium, or deep
 * transformation levels. Called by the orchestrator in a concurrency-limited loop.
 *
 * Service signature: generateVariation({ exercise, level }): Promise<{ exercise: Exercise }>
 * One bad exercise must not sink the whole duplication run — invalid JSON gets one retry,
 * then the exercise is marked failed and the loop continues.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

import type { Payload } from 'payload'
import type { Exercise } from '@/payload-types'
import type { DuplicationLevel } from '@/server/payload/collections/LessonDuplications'
import type { AIModel, AIModelKey } from '../models'

import { getModelRegistryEntry, getProviderModelName } from '../models'
import { LLMProviderType } from '../providers/types'
import { logger } from '@/infra/utils/logger'
import { VariationGenerationError } from '../errors'

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Loading
// ─────────────────────────────────────────────────────────────────────────────

// Inline fallbacks mirroring the content of the prompt markdown files.
// Used when the external prompt files cannot be loaded (e.g., in serverless environments).
const PROMPT_FALLBACKS: Record<Exclude<DuplicationLevel, 'none'>, string> = {
  light: `# Lesson Duplication — Light Variation Agent

You are an expert educational content variation generator specializing in light-level transformations.

## Task

Generate a light variation of the provided exercise. Light variation means: **numeric values only are changed**, while all phrasing, structure, sections, and SVG content are preserved exactly.

## Rules

1. **Same topic**: The exercise must cover the same mathematical or scientific concept.
2. **Same difficulty**: Maintain the same complexity level and skill requirements.
3. **Numeric values changed**: Replace all numeric values (numbers, coefficients, constants, parameters) with different values. The new values should be reasonable for the same problem context.
4. **Phrasing preserved**: Keep all text, wording, and sentences exactly as-is.
5. **Structure preserved**: Keep all blocks, sections, and layout exactly as-is.
6. **SVG preserved**: Keep all SVG markup exactly as-is. Do not modify or regenerate SVG.
7. **No unsolvable problems**: Ensure the variation still has a valid, correct answer.
8. **No contradictions**: Question, hint, solution, and full_solution must all be consistent with each other.
9. **NO PNG output**: Never produce or include any PNG image data. Only text and SVG are allowed.

## Output Format

Return a JSON object with the exercise content. The structure must match the input exercise shape — preserve all \`id\` fields, block order, and field names.

\`\`\`json
{
  "content": {
    "blocks": [ ... variation blocks ... ]
  }
}
\`\`\`

Return ONLY the JSON. No markdown fences, no explanation.`,
  medium: `# Lesson Duplication — Medium Variation Agent

You are an expert educational content variation generator specializing in medium-level transformations.

## Task

Generate a medium variation of the provided exercise. Medium variation means: **numeric values are changed AND phrasing is reworded** (synonyms, sentence restructuring), while structure and SVG content are preserved exactly.

## Rules

1. **Same topic**: The exercise must cover the same mathematical or scientific concept.
2. **Same difficulty**: Maintain the same complexity level and skill requirements.
3. **Numeric values changed**: Replace all numeric values (numbers, coefficients, constants, parameters) with different values. The new values should be reasonable for the same problem context.
4. **Phrasing reworded**: Rewrite text using synonyms, different sentence structures, and alternative phrasings while preserving the exact meaning.
5. **Structure preserved**: Keep all blocks, sections, and layout exactly as-is.
6. **SVG preserved**: Keep all SVG markup exactly as-is. Do not modify or regenerate SVG.
7. **No unsolvable problems**: Ensure the variation still has a valid, correct answer.
8. **No contradictions**: Question, hint, solution, and full_solution must all be consistent with each other.
9. **NO PNG output**: Never produce or include any PNG image data. Only text and SVG are allowed.

## Output Format

Return a JSON object with the exercise content. The structure must match the input exercise shape — preserve all \`id\` fields, block order, and field names.

\`\`\`json
{
  "content": {
    "blocks": [ ... variation blocks ... ]
  }
}
\`\`\`

Return ONLY the JSON. No markdown fences, no explanation.`,
  deep: `# Lesson Duplication — Deep Variation Agent

You are an expert educational content variation generator specializing in deep-level transformations.

## Task

Generate a deep variation of the provided exercise. Deep variation means: **numeric values, functions/expressions, and sections may be changed, added, or removed**. SVG may be regenerated as SVG (never produce PNG).

## Rules

1. **Same topic**: The exercise must cover the same mathematical or scientific concept.
2. **Same difficulty**: Maintain the same complexity level and skill requirements.
3. **Values changed**: Replace all numeric values (numbers, coefficients, constants, parameters) with different values. The new values should be reasonable for the same problem context.
4. **Functions/expressions changed**: You may modify mathematical functions, expressions, and formulas while maintaining the same underlying concept.
5. **Sections changed**: You may add, remove, or modify sections and blocks as needed to create a meaningful variation.
6. **SVG may be regenerated as SVG**: If you modify or regenerate SVG, it must remain SVG (vector) format. Never produce PNG image data.
7. **No unsolvable problems**: Ensure the variation still has a valid, correct answer.
8. **No contradictions**: Question, hint, solution, and full_solution must all be consistent with each other.
9. **NO PNG output**: Never produce or include any PNG image data. Only text and SVG are allowed.

## Output Format

Return a JSON object with the exercise content. The structure should match the input exercise shape — preserve all \`id\` fields where applicable, maintain block order where possible.

\`\`\`json
{
  "content": {
    "blocks": [ ... variation blocks ... ]
  }
}
\`\`\`

Return ONLY the JSON. No markdown fences, no explanation.`,
}

function loadPrompt(level: Exclude<DuplicationLevel, 'none'>): string {
  const filePath = join(__dirname, '..', 'prompts', `lesson-duplication-${level}-agent-prompt.md`)
  try {
    return readFileSync(filePath, 'utf-8')
  } catch (error: unknown) {
    logger.warn(
      { err: error, path: filePath },
      `[LessonDuplicationVariation] Failed to load prompt file for ${level}, using inline fallback`,
    )
    return PROMPT_FALLBACKS[level]
  }
}

const PROMPT_MAP: Record<Exclude<DuplicationLevel, 'none'>, string> = {
  light: loadPrompt('light'),
  medium: loadPrompt('medium'),
  deep: loadPrompt('deep'),
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateVariationInput {
  exercise: Exercise
  level: Exclude<DuplicationLevel, 'none'>
}

/**
 * Generate a variation for a single exercise at the specified transformation level.
 *
 * On invalid JSON or schema mismatch from the LLM: retries once with the same prompt.
 * If the retry also fails, throws VariationGenerationError — the caller (orchestrator)
 * catches and records it as a failure without aborting the run.
 */
export async function generateVariation(
  input: GenerateVariationInput,
  payload: Payload,
): Promise<{ exercise: Exercise }> {
  const { exercise, level } = input
  const exerciseId = typeof exercise.id === 'string' ? exercise.id : String(exercise.id)

  const systemPrompt = PROMPT_MAP[level]
  const userPrompt = buildUserPrompt(exercise)

  let retryCount = 0
  const startTime = Date.now()

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
      const adapter = await createGenkitUnifiedAdapter(payload)
      const modelConfig = resolveModelConfig('LESSON_DUPLICATION_VARIATION')

      const result = await adapter.generateChatCompletion(
        {
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          model: modelConfig,
          acknowledgment: `Generating ${level} variation for exercise`,
        },
        payload,
      )

      const parsed = parseVariationResponse(result.text)

      const latencyMs = Date.now() - startTime
      logger.info({ latencyMs, level, exerciseId, retryCount }, '[LessonDuplicationVariation]')

      return { exercise: { ...exercise, ...parsed } }
    } catch (error) {
      if (isJsonParseError(error)) {
        // Throw if we've already retried once; otherwise record the retry and continue
        if (retryCount > 0) {
          const latencyMs = Date.now() - startTime
          logger.error(
            { latencyMs, level, exerciseId, retryCount, err: error },
            '[LessonDuplicationVariation] Retry exhausted',
          )
          throw new VariationGenerationError(
            exerciseId,
            error instanceof Error ? error.message : 'Invalid JSON from LLM after retry',
          )
        }
        retryCount++
        // Will retry
        continue
      }
      // Non-JSON error — throw immediately (not retryable in this service's scope)
      const latencyMs = Date.now() - startTime
      logger.error(
        { latencyMs, level, exerciseId, retryCount, err: error },
        '[LessonDuplicationVariation] Non-retryable error',
      )
      throw new VariationGenerationError(
        exerciseId,
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }
  // Unreachable — loop exits only via throw
  throw new VariationGenerationError(exerciseId, 'Unexpected loop exit')
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(exercise: Exercise): string {
  return `Generate a variation for the following exercise.\n\nInput exercise:\n${JSON.stringify(exercise, null, 2)}`
}

function parseVariationResponse(text: string): Partial<Exercise> {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  if (!parsed.content || !Array.isArray(parsed.content.blocks)) {
    throw new SyntaxError('Response missing required content.blocks field')
  }

  return parsed as Partial<Exercise>
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
