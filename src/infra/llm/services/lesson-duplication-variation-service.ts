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

/**
 * Per-LLM-call timeout. A stuck Gemini call would otherwise leave the
 * duplication record in `running` indefinitely. 60s comfortably exceeds the
 * p95 for Gemini 3.1 Pro with thinking budget at this prompt size.
 */
export const LLM_CALL_TIMEOUT_MS = 60_000

class LlmCallTimeoutError extends Error {
  readonly code = 'LLM_CALL_TIMEOUT'
  constructor(stage: string) {
    super(`LLM call timed out after ${LLM_CALL_TIMEOUT_MS}ms in ${stage}`)
  }
}

/** Race a promise against a timer; throws LlmCallTimeoutError if the timer wins. */
function withTimeout<T>(
  promise: Promise<T>,
  stage: string,
  timeoutMs = LLM_CALL_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LlmCallTimeoutError(stage)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Loading
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: a previous version of this file kept ~400 lines of inline prompt
// fallbacks, used when the on-disk prompt files couldn't be read. That path
// silently degraded output because the fallbacks pre-dated K7 (subject-aware)
// and K12 (few-shot examples). We now fail loudly: if the file can't be read,
// `loadSubjectPrompt` throws and the orchestrator records a per-exercise
// failure (instead of producing a quietly weaker variation).
//
// Why this is safe: a missing prompt file is a deployment bug, not a runtime
// condition we want to paper over. One failed exercise lands on the K6 review
// screen with a clear "GENERATION_FAILED" code; the rest of the run is fine.
/**
 * Read the subject + level prompt from disk.
 * Throws when the file is missing — better to fail one exercise with a clear
 * code than to silently fall back to a stale generic prompt and degrade output
 * quality across the entire duplication run.
 */
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
    logger.error(
      { err: error, path: filePath, subject, level },
      '[LessonDuplicationVariation] Prompt file missing — refusing to use stale fallback',
    )
    throw new Error(`Missing prompt file for subject=${subject} level=${level} at ${filePath}`)
  }
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
  const creativePrompt = loadSubjectPrompt(subject, level)
  const creativeUserPrompt = buildUserPrompt(exercise)

  let creativeRetryCount = 0
  let pass1Output: Partial<Exercise> | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
      const adapter = await createGenkitUnifiedAdapter(payload)
      const creativeConfig = resolveModelConfig('LESSON_DUPLICATION_VARIATION_CREATIVE')

      const result = await withTimeout(
        adapter.generateChatCompletion(
          {
            system: creativePrompt,
            messages: [{ role: 'user', content: creativeUserPrompt }],
            model: creativeConfig,
            acknowledgment: `Generating ${level} variation for exercise`,
          },
          payload,
        ),
        'pass-1-creative',
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

      const result = await withTimeout(
        adapter.generateChatCompletion(
          {
            system: derivationPrompt,
            messages: [{ role: 'user', content: '' }],
            model: deterministicConfig,
            acknowledgment: 'Deriving solution for exercise variation',
          },
          payload,
        ),
        'pass-2-deterministic',
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

  // Only question blocks own the solution/answer fields. Applying pass-2's
  // solution/fullSolution to non-question blocks (rich_text, svg, latex, …)
  // would attach fields the block schemas don't allow, breaking Zod strict
  // mode and confusing downstream renderers.
  const isQuestionBlock = (type: unknown): boolean =>
    typeof type === 'string' && type.startsWith('question_')

  return pass1Blocks.map((block: unknown) => {
    const b = block as Record<string, unknown>
    if (!isQuestionBlock(b.type)) {
      return b
    }

    const result: Record<string, unknown> = { ...b }
    if (pass2Patch.solution !== undefined) {
      result.solution = pass2Patch.solution
    }
    if (pass2Patch.fullSolution !== undefined) {
      result.fullSolution = pass2Patch.fullSolution
    }
    if (pass2Patch.answer?.correctOptionIds !== undefined) {
      const existingAnswer = (result.answer as Record<string, unknown> | undefined) ?? {}
      result.answer = {
        ...existingAnswer,
        correctOptionIds: pass2Patch.answer.correctOptionIds,
      }
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
