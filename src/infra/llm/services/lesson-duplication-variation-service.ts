/**
 * Lesson Duplication Variation Service
 *
 * Generates variations for a single exercise at a time with light, medium, or deep
 * transformation levels. Called by the orchestrator in a concurrency-limited loop.
 *
 * Service signature: generateVariation({ exercise, level, subject }): Promise<{ exercise: Exercise }>
 *
 * Two-pass approach:
 * - Pass 1 (creative): generates new question/hint/phrasing at temp 0.7
 * - Pass 2 (deterministic): re-derives solution at temp 0.0
 *
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
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DuplicationSubject = 'algebra' | 'geometry' | 'calculus' | 'mixed' | 'other'

export const DUPLICATION_SUBJECTS = ['algebra', 'geometry', 'calculus', 'mixed', 'other'] as const

export interface GenerateVariationInput {
  exercise: Exercise
  level: Exclude<DuplicationLevel, 'none'>
  subject: DuplicationSubject
}

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

// Subject-specific clauses appended to base level prompts
const SUBJECT_CLAUSES: Partial<Record<DuplicationSubject, string>> = {
  geometry: `

## Subject-specific rules: Geometry

If the exercise contains question_geometry or question_axis blocks, you are generating a geometric exercise. Adhere to these rules:
- For question_geometry blocks: treat the geometry specification as valid GeometrySpecV1 JSON with kind="euclidean", a canvas { width, height, background?, grid?, axis?, boundingBox? }, and an elements object containing: points, lines, circles, angles, vectors, areas, rectangles, triangles, texts, equalSegments, tangents.
- For question_axis blocks: treat the axis/graph specification as valid AxisSpecV1 JSON.
- Preserve shape relationships and topology. Only numeric coordinates, lengths, and angle values may be changed. Do not reorder, add, or remove named points, lines, or shapes.
- All JSON output for geometry/axis blocks must be structurally valid: objects with the field names above. Do not truncate required array fields.`,
  calculus: `

## Subject-specific rules: Calculus

For calculus exercises, you MUST re-derive the complete solution from first principles in full_solution. Show every step explicitly: identify the rule used (power rule, chain rule, product rule, quotient rule, u-substitution, integration by parts, L'Hôpital's rule, etc.), write each algebraic simplification step, and state the final answer. The full_solution must contain the full step-by-step derivation, not just the final answer. The solution and correct_option must match the newly derived answer, not the original.`,
}

function loadSubjectPrompt(
  subject: DuplicationSubject,
  level: Exclude<DuplicationLevel, 'none'>,
): string {
  const filePath = join(
    __dirname,
    '..',
    'prompts',
    'lesson-duplication',
    `${subject}-${level}-agent-prompt.md`,
  )
  try {
    return readFileSync(filePath, 'utf-8')
  } catch (error: unknown) {
    logger.warn(
      { err: error, path: filePath },
      `[LessonDuplicationVariation] Failed to load subject prompt file for ${subject}-${level}, using inline fallback`,
    )
    return PROMPT_FALLBACKS[level] + (SUBJECT_CLAUSES[subject] ?? '')
  }
}

function getPromptForSubject(
  subject: DuplicationSubject,
  level: Exclude<DuplicationLevel, 'none'>,
): string {
  const basePrompt = loadSubjectPrompt(subject, level)
  // If the loaded prompt already contains subject-specific content, don't append again
  if (basePrompt !== PROMPT_FALLBACKS[level]) {
    return basePrompt
  }
  // Append subject clause to inline fallback
  return basePrompt + (SUBJECT_CLAUSES[subject] ?? '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a variation for a single exercise at the specified transformation level.
 *
 * Two-pass approach:
 * - Pass 1 (creative): generates new question/hint/phrasing at temp 0.7
 * - Pass 2 (deterministic): re-derives solution at temp 0.0
 *
 * On invalid JSON or schema mismatch from the LLM: retries once with the same prompt.
 * If the retry also fails, throws VariationGenerationError — the caller (orchestrator)
 * catches and records it as a failure without aborting the run.
 */
export async function generateVariation(
  input: GenerateVariationInput,
  payload: Payload,
): Promise<{ exercise: Exercise }> {
  const { exercise, level, subject } = input
  const exerciseId = typeof exercise.id === 'string' ? exercise.id : String(exercise.id)
  const startTime = Date.now()

  // Pass 1 — Creative (question + hint + phrasing)
  const creativePrompt = getPromptForSubject(subject, level)
  const creativeUserPrompt = buildUserPrompt(exercise)

  let creativeRetryCount = 0
  let pass1Output: Partial<Exercise> | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
      const adapter = await createGenkitUnifiedAdapter(payload)
      const creativeConfig = resolveModelConfig('LESSON_DUPLICATION_VARIATION_CREATIVE')

      const result = await adapter.generateChatCompletion(
        {
          system: creativePrompt,
          messages: [{ role: 'user', content: creativeUserPrompt }],
          model: creativeConfig,
          acknowledgment: `Generating ${level} variation for exercise`,
        },
        payload,
      )

      pass1Output = parseVariationResponse(result.text)
      break
    } catch (error) {
      if (isJsonParseError(error)) {
        if (creativeRetryCount > 0) {
          const latencyMs = Date.now() - startTime
          logger.error(
            { latencyMs, level, subject, exerciseId, creativeRetryCount, err: error },
            '[LessonDuplicationVariation] Pass 1 retry exhausted',
          )
          throw new VariationGenerationError(
            exerciseId,
            error instanceof Error ? error.message : 'Invalid JSON from LLM after retry',
          )
        }
        creativeRetryCount++
        continue
      }
      const latencyMs = Date.now() - startTime
      logger.error(
        { latencyMs, level, subject, exerciseId, err: error },
        '[LessonDuplicationVariation] Pass 1 non-retryable error',
      )
      throw new VariationGenerationError(
        exerciseId,
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  if (!pass1Output) {
    throw new VariationGenerationError(exerciseId, 'Unexpected: pass 1 produced no output')
  }

  // Pass 2 — Deterministic (solution derivation)
  const derivationPrompt = buildSolutionDerivationPrompt(exercise, pass1Output)
  let pass2RetryCount = 0
  let pass2Patch: Pass2Patch | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
      const adapter = await createGenkitUnifiedAdapter(payload)
      const deterministicConfig = resolveModelConfig('LESSON_DUPLICATION_VARIATION_DETERMINISTIC')

      const result = await adapter.generateChatCompletion(
        {
          system: derivationPrompt,
          messages: [{ role: 'user', content: '' }],
          model: deterministicConfig,
          acknowledgment: 'Deriving solution for exercise variation',
        },
        payload,
      )

      pass2Patch = parseSolutionDerivationResponse(result.text)
      break
    } catch (error) {
      if (isJsonParseError(error)) {
        if (pass2RetryCount > 0) {
          const latencyMs = Date.now() - startTime
          logger.error(
            { latencyMs, level, subject, exerciseId, pass2RetryCount, err: error },
            '[LessonDuplicationVariation] Pass 2 retry exhausted',
          )
          throw new VariationGenerationError(
            exerciseId,
            error instanceof Error ? error.message : 'Invalid JSON from LLM after retry',
          )
        }
        pass2RetryCount++
        continue
      }
      const latencyMs = Date.now() - startTime
      logger.error(
        { latencyMs, level, subject, exerciseId, err: error },
        '[LessonDuplicationVariation] Pass 2 non-retryable error',
      )
      throw new VariationGenerationError(
        exerciseId,
        error instanceof Error ? error.message : 'Unknown error',
      )
    }
  }

  if (!pass2Patch) {
    throw new VariationGenerationError(exerciseId, 'Unexpected: pass 2 produced no output')
  }

  // Merge: pass-1 blocks (question/hint) + pass-2 solution fields
  const mergedBlocks = mergePassOutputs(pass1Output, pass2Patch)

  const latencyMs = Date.now() - startTime
  logger.info(
    { latencyMs, level, subject, exerciseId },
    '[LessonDuplicationVariation] Two-pass complete',
  )

  return { exercise: { ...exercise, content: { blocks: mergedBlocks } } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(exercise: Exercise): string {
  return `Generate a variation for the following exercise.\n\nInput exercise:\n${JSON.stringify(exercise, null, 2)}`
}

function buildSolutionDerivationPrompt(exercise: Exercise, pass1Output: Partial<Exercise>): string {
  return `You are a strict mathematical derivation assistant. Given a newly generated exercise question,
re-derive the correct answer from first principles and return only the solution fields.

Input original exercise:
${JSON.stringify(exercise, null, 2)}

Pass 1 generated question/phrasing:
${JSON.stringify(pass1Output, null, 2)}

Task:
1. Solve the new question independently (do not trust any answer provided in pass 1 output).
2. Write the complete step-by-step solution in fullSolution (show every step).
3. Write a brief solution in solution.
4. Return ONLY these fields (do not include any other fields):
{
  "solution": <rich_text object>,
  "fullSolution": <rich_text object>,
  "answer": { "correctOptionIds": [<correct option id>] }
}

rich_text object format: { "type": "rich_text", "format": "md-math-v1", "value": "...", "mediaIds": [] }

Return ONLY the JSON. No markdown fences, no explanation.`
}

interface Pass2Patch {
  solution?: unknown
  fullSolution?: unknown
  answer?: { correctOptionIds: string[] }
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

function parseSolutionDerivationResponse(text: string): Pass2Patch {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  return JSON.parse(cleaned) as Pass2Patch
}

function mergePassOutputs(pass1Output: Partial<Exercise>, pass2Patch: Pass2Patch): unknown[] {
  const pass1Blocks = (pass1Output.content as { blocks: unknown[] } | undefined)?.blocks ?? []

  // For each block in pass1Output, overlay pass2 solution fields
  return pass1Blocks.map((block: unknown) => {
    const b = block as Record<string, unknown>
    const result: Record<string, unknown> = { ...b }

    // Pass-2 overwrites solution fields if provided
    if (pass2Patch.solution !== undefined) {
      result.solution = pass2Patch.solution
    }
    if (pass2Patch.fullSolution !== undefined) {
      result.fullSolution = pass2Patch.fullSolution
    }
    if (pass2Patch.answer?.correctOptionIds !== undefined) {
      if (!result.answer) result.answer = {}
      ;(result.answer as Record<string, unknown>).correctOptionIds =
        pass2Patch.answer.correctOptionIds
    }

    return result
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
