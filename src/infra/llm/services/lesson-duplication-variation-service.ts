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
 * duplication record in `running` indefinitely. 180s leaves headroom for
 * gemini-2.5-pro with thinking budget at this prompt size — early runs at
 * 60s timed out on complex calculus exercises before the model returned.
 */
export const LLM_CALL_TIMEOUT_MS = 180_000

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
 * Read the subject+level prompt from disk. Path is resolved relative to
 * `process.cwd()` (= project root locally, `/var/task` on Vercel).
 *
 * For Vercel: `next.config.js` declares `outputFileTracingIncludes` for the
 * routes that may invoke this service, so the .md files ship next to the
 * serverless function bundle. Earlier `__dirname/..` resolution broke on
 * Vercel because chunks land in `.next/server/chunks/` rather than next to
 * the source folder; `process.cwd()` is stable across both environments.
 */
function loadSubjectPrompt(
  subject: DuplicationSubject,
  level: Exclude<DuplicationLevel, 'none'>,
): string {
  const filename = `${subject}-${level}-agent-prompt.md`
  const candidates = [
    join(process.cwd(), 'src/infra/llm/prompts/lesson-duplication', filename),
    // Vercel may unpack into /var/task root rather than under src/
    join(process.cwd(), 'infra/llm/prompts/lesson-duplication', filename),
  ]
  for (const candidate of candidates) {
    try {
      const text = readFileSync(candidate, 'utf-8')
      if (text.trim().length > 0) return text
    } catch {
      // try next candidate
    }
  }
  logger.error(
    { subject, level, candidates },
    '[LessonDuplicationVariation] Prompt file not found in any candidate path',
  )
  throw new Error(`Missing prompt for subject=${subject} level=${level}`)
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

  let creativeJsonRetried = false
  let creativeRateLimitRetries = 0
  let creativeBreakerRetries = 0
  let pass1Output: Partial<Exercise> | null = null

  // Retry envelope: 1 JSON-parse retry + rate-limit backoffs + circuit-breaker
  // cooldown waits. The Genkit adapter wraps every call in a 60s circuit
  // breaker; once it opens, subsequent exercises also fail until cooldown ends.
  // We respect the breaker's "Try again in Xs" message and pause for that long.
  const maxAttempts = 1 + 1 + (RATE_LIMIT_MAX_ATTEMPTS - 1) + CIRCUIT_BREAKER_MAX_ATTEMPTS
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
      const breakerCooldown = getCircuitBreakerCooldownMs(error)
      if (breakerCooldown !== null && creativeBreakerRetries < CIRCUIT_BREAKER_MAX_ATTEMPTS) {
        logger.warn(
          { level, subject, exerciseId, cooldownMs: breakerCooldown },
          '[LessonDuplicationVariation] Pass 1 hit circuit breaker, waiting for cooldown',
        )
        creativeBreakerRetries++
        await sleep(breakerCooldown)
        continue
      }
      if (isRateLimitError(error) && creativeRateLimitRetries < RATE_LIMIT_MAX_ATTEMPTS - 1) {
        const backoff = RATE_LIMIT_BACKOFFS_MS[creativeRateLimitRetries] ?? 12_000
        logger.warn(
          { level, subject, exerciseId, attempt: creativeRateLimitRetries + 1, backoff },
          '[LessonDuplicationVariation] Pass 1 rate-limited, backing off',
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
        { latencyMs, level, subject, exerciseId, err: error },
        '[LessonDuplicationVariation] Pass 1 failed (non-retryable or retries exhausted)',
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
      const breakerCooldown = getCircuitBreakerCooldownMs(error)
      if (breakerCooldown !== null && pass2BreakerRetries < CIRCUIT_BREAKER_MAX_ATTEMPTS) {
        logger.warn(
          { level, subject, exerciseId, cooldownMs: breakerCooldown },
          '[LessonDuplicationVariation] Pass 2 hit circuit breaker, waiting for cooldown',
        )
        pass2BreakerRetries++
        await sleep(breakerCooldown)
        continue
      }
      if (isRateLimitError(error) && pass2RateLimitRetries < RATE_LIMIT_MAX_ATTEMPTS - 1) {
        const backoff = RATE_LIMIT_BACKOFFS_MS[pass2RateLimitRetries] ?? 12_000
        logger.warn(
          { level, subject, exerciseId, attempt: pass2RateLimitRetries + 1, backoff },
          '[LessonDuplicationVariation] Pass 2 rate-limited, backing off',
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
        { latencyMs, level, subject, exerciseId, err: error },
        '[LessonDuplicationVariation] Pass 2 failed (non-retryable or retries exhausted)',
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

/**
 * True for Gemini / Vertex rate-limit and quota-exhausted errors. We treat
 * these as retryable with exponential backoff — concurrency plus 2 passes
 * per exercise can momentarily exceed the per-minute quota for Gemini 3.1 Pro.
 */
function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('too many requests')
  )
}

/**
 * Returns the suggested cooldown in ms if the error is from the genkit
 * circuit-breaker, else null. The breaker's message format is
 * `circuit breaker is open ... Try again in 58s.` — parse the seconds.
 */
function getCircuitBreakerCooldownMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null
  if (!/circuit breaker is open/i.test(error.message)) return null
  const m = error.message.match(/try again in\s+(\d+)\s*s/i)
  const secs = m ? parseInt(m[1], 10) : 60
  // Add a small jitter buffer so the next call doesn't race the cooldown.
  return secs * 1000 + 1_000
}

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Max attempts when the LLM returns a rate-limit error. Total attempts. */
const RATE_LIMIT_MAX_ATTEMPTS = 4

/** Backoff schedule (ms) between rate-limit retries — 2s, 5s, 12s. */
const RATE_LIMIT_BACKOFFS_MS = [2_000, 5_000, 12_000]

/** Max attempts when the circuit breaker is open. Each waits ~60s. */
const CIRCUIT_BREAKER_MAX_ATTEMPTS = 2
