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
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { SolutionDerivationOutputSchema } from '../schemas/lesson-duplication-output'

/**
 * Model used for both passes. Pinned to gemini-3.1-pro-preview because:
 *  - Pass 1: schema-constrained output on this codebase's `content.blocks`
 *    shape is only reliable on 3.x — 2.5-pro silently collapses the structured
 *    response to `{ "content": "blocks" }` literals.
 *  - Pass 2: 2.5-pro times out (>180s) on complex calculus/axis derivations
 *    even with a small schema; 3.x is faster and still schema-compliant.
 * Verified live 2026-05-13.
 */
const VARIATION_MODEL_VERSION = 'gemini-3.1-pro-preview'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DuplicationSubject = 'algebra' | 'geometry' | 'calculus' | 'mixed' | 'other'

/** Token usage from LLM calls — accumulated across the two passes. */
export interface TokensUsed {
  inputTokens: number
  outputTokens: number
}

export const DUPLICATION_SUBJECTS = ['algebra', 'geometry', 'calculus', 'mixed', 'other'] as const

export interface GenerateVariationInput {
  exercise: Exercise
  level: Exclude<DuplicationLevel, 'none'>
  subject: DuplicationSubject
}

import { withTimeout as withSharedTimeout } from '@/infra/utils/with-timeout'

/**
 * Per-LLM-call timeout. A stuck Gemini call would otherwise leave the
 * duplication record in `running` indefinitely. 300s observed empirically on
 * gemini-3.1-pro-preview for a complex calculus/axis exercise: schema-
 * constrained pass 1 around 120-180s, pass-2 re-derivation in the 150-200s
 * range, with bursts above 180s on the heaviest exercises. The Vercel Pro
 * function ceiling is 900s, so we still have headroom for the surrounding
 * orchestrator work.
 */
export const LLM_CALL_TIMEOUT_MS = 600_000

/** Convenience wrapper that pins the default timeout to LLM_CALL_TIMEOUT_MS. */
function withTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
  return withSharedTimeout(promise, stage, LLM_CALL_TIMEOUT_MS)
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
): Promise<{ exercise: Exercise; tokensUsed: TokensUsed }> {
  const { exercise, level, subject } = input
  const exerciseId = typeof exercise.id === 'string' ? exercise.id : String(exercise.id)
  const startTime = Date.now()

  // Accumulate token usage across the two passes (issue #1552)
  let totalInputTokens = 0
  let totalOutputTokens = 0

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
  //
  // Worst-case wall time per pass (one timeout + all backoffs + 2 breaker
  // waits) ≈ 180s + (2+5+12)s + 2×60s ≈ ~5min. Two passes per exercise = ~10min
  // worst case. With CONCURRENCY_LIMIT=1 this multiplies linearly with exercise
  // count, easily exceeding Vercel function timeout for big lessons. If the
  // function is killed mid-exercise the LessonDuplications record stays in
  // 'running' with whatever partial progress was streamed to DB; an admin can
  // re-trigger via the jobs UI. Long-term fix is an external queue worker
  // (Inngest / Trigger.dev) — out of scope for this PR.
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
            // NOTE: outputJsonSchema intentionally omitted.
            // Verified live (2026-05-24) that Gemini 3.1-pro-preview silently
            // ignores responseSchema slots/required for hint/solution/fullSolution
            // — even when the per-exercise derived schema declares them required,
            // pass-1 output has 0/N hints. Without the schema, prompt-level rules
            // produce N/N hints. Same collapse pattern as pass-2 (issue #1748).
            // Structural validity is enforced post-hoc by sanitizeAiBlocks +
            // payload.create's strict Zod schema. Keep buildPass1JsonSchemaForExercise
            // exported in case Gemini's responseSchema improves.
            modelVersion: VARIATION_MODEL_VERSION,
          },
          payload,
        ),
        'pass-1-creative',
      )

      pass1Output = extractPass1Output(result)

      // Accumulate token usage from pass 1 (issue #1552)
      if (result.usage) {
        totalInputTokens += result.usage.inputTokens
        totalOutputTokens += result.usage.outputTokens
      }

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
            // NOTE: outputSchema is intentionally omitted here.
            // Gemini's responseSchema collapses the per-block array shape to
            // a literal string array of property names (e.g. { "blocks": ["id", "solution", ...] })
            // — the same collapse pattern observed for LessonVariationOutputSchema (pass 1).
            // We parse text only and validate post-hoc with Zod's safeParse.
            // See: issue #1748
            modelVersion: VARIATION_MODEL_VERSION,
          },
          payload,
        ),
        'pass-2-deterministic',
      )

      pass2Patch = extractPass2Patch(result, pass1Output)

      // Accumulate token usage from pass 2 (issue #1552)
      if (result.usage) {
        totalInputTokens += result.usage.inputTokens
        totalOutputTokens += result.usage.outputTokens
      }

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

  // Sanitize AI output before we hand it to payload.create. Catches the
  // common "Gemini hallucinated a field" class of bug (e.g. `answer.kind` on a
  // question_select block, which broke the calculus run) by stripping known
  // bad fields. Truly malformed blocks still fail at payload.create — which
  // the orchestrator's per-exercise isolation handles as GENERATION_FAILED.
  const cleanedBlocks = sanitizeAiBlocks(mergedBlocks)

  const latencyMs = Date.now() - startTime
  logger.info(
    { latencyMs, level, subject, exerciseId },
    '[LessonDuplicationVariation] Two-pass complete',
  )

  return {
    exercise: { ...exercise, content: { blocks: cleanedBlocks } },
    tokensUsed: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI output sanitization + schema gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema-driven strip of fields Gemini hallucinates that the strict Exercise
 * schema rejects. Runs ContentSchema.safeParse, finds every `unrecognized_keys`
 * issue, deletes those keys at the reported path, and retries — up to a small
 * iteration limit (in practice 1-2 iterations are enough). Catches the whole
 * family of "answer has type/rubric", "block has extraField", etc. without
 * enumerating each one by hand.
 *
 * Before the generic strip, applies targeted field migrations for known
 * Gemini quirks where the field NAME is wrong but the data is valid (e.g.
 * `answer.rubric: "x = 4"` for a question_free_response, where the schema
 * expects `answer.acceptedAnswers: ["x = 4"]`). Migrating beats stripping
 * here — stripping would lose the actual answer.
 *
 * Other Zod failure codes (invalid_type, too_small, etc.) are NOT touched —
 * those are real validation problems for the orchestrator's catch block to
 * surface in failures[].
 */
function sanitizeAiBlocks(blocks: unknown[]): unknown[] {
  const envelope = { blocks: structuredClone(blocks) }

  // Targeted migration: question_free_response.answer.rubric → answer.acceptedAnswers.
  // Gemini regularly emits `{ type: "free_response", rubric: "answer text" }`
  // instead of `{ acceptedAnswers: ["answer text"] }`. Strip would drop the
  // actual answer; migration preserves it.
  for (const block of envelope.blocks as Array<Record<string, unknown>>) {
    if (!block || typeof block !== 'object') continue
    if (block.type !== 'question_free_response') continue
    const ans = block.answer as Record<string, unknown> | undefined
    if (!ans || typeof ans !== 'object') continue
    if (typeof ans.rubric === 'string' && !Array.isArray(ans.acceptedAnswers)) {
      ans.acceptedAnswers = [ans.rubric]
    }
  }

  const MAX_ITERATIONS = 10
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = ContentSchema.safeParse(envelope)
    if (result.success) break
    let stripped = false
    for (const issue of result.error.issues) {
      if (issue.code !== 'unrecognized_keys') continue
      const keys = (issue as { keys?: string[] }).keys
      if (!Array.isArray(keys) || keys.length === 0) continue
      // issue.path points at the parent object that has the unknown keys.
      // Walk into envelope to find it.
      let parent: unknown = envelope
      for (const segment of issue.path) {
        if (parent && typeof parent === 'object') {
          parent = (parent as Record<string | number, unknown>)[segment as string | number]
        }
      }
      if (parent && typeof parent === 'object') {
        for (const k of keys) {
          delete (parent as Record<string, unknown>)[k]
        }
        stripped = true
      }
    }
    if (!stripped) break // no unrecognized_keys remain; other errors will surface at payload.create
  }
  return envelope.blocks
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildUserPrompt(exercise: Exercise): string {
  return `Generate a variation for the following exercise.\n\nInput exercise:\n${JSON.stringify(exercise, null, 2)}`
}

function buildSolutionDerivationPrompt(exercise: Exercise, pass1Output: Partial<Exercise>): string {
  // Collect all question blocks from pass 1 output with their ids.
  const pass1Blocks = (pass1Output.content as { blocks: unknown[] } | undefined)?.blocks ?? []
  const questionBlocks = pass1Blocks.filter(
    (b: unknown) =>
      typeof (b as Record<string, unknown>).type === 'string' &&
      String((b as Record<string, unknown>).type).startsWith('question_'),
  ) as Array<{ id: string; type: string }>

  if (questionBlocks.length === 0) {
    // No question blocks — return empty blocks array.
    return `You are a strict mathematical derivation assistant.
There are NO question blocks in this exercise. Return ONLY:
{ "blocks": [] }

Return ONLY the JSON. No markdown fences, no explanation.`
  }

  // Enumerate each question block by id so the model solves each independently.
  const blockList = questionBlocks.map((b) => `  - id "${b.id}" (type: ${b.type})`).join('\n')

  return `You are a strict mathematical derivation assistant. Given a newly generated exercise question,
re-derive the correct answer from first principles and return per-block solution patches.

Input original exercise:
${JSON.stringify(exercise, null, 2)}

Pass 1 generated question/phrasing:
${JSON.stringify(pass1Output, null, 2)}

Question blocks found in pass 1 output:
${blockList}

Task:
For EACH question block listed above:
1. Solve that question independently (do not trust any answer provided in pass 1 output).
2. Write the complete step-by-step solution in fullSolution (show every step).
3. Write a brief solution in solution.
4. For MCQ/select blocks, include answer with correctOptionIds.

Return ONLY this JSON structure (an array with one entry per question block):
{
  "blocks": [
    { "id": "<block id>", "solution": <rich_text object>, "fullSolution": <rich_text object>, "answer": { "correctOptionIds": [<id>] } },
    ...
  ]
}

rich_text object format: { "type": "rich_text", "format": "md-math-v1", "value": "...", "mediaIds": [] }

Return ONLY the JSON. No markdown fences, no explanation.`
}

interface Pass2PatchBlock {
  id: string
  solution?: unknown
  fullSolution?: unknown
  answer?: { correctOptionIds: string[] }
}

interface Pass2Patch {
  blocks: Pass2PatchBlock[]
}

/**
 * Adapter response from `generateChatCompletion`. `output` is set when the
 * call was made with an `outputSchema` (Genkit's parsed structured value).
 */
interface AdapterResult {
  text: string
  output?: unknown
}

/**
 * Pull pass-1's content envelope out of the adapter result. Prefers Genkit's
 * parsed `output` (already schema-validated). Falls back to parsing `text`,
 * which keeps the path alive if the provider returns JSON-as-text without
 * also populating `output` (e.g. when output schema was rejected and the
 * model fell back to free text).
 */
function extractPass1Output(result: AdapterResult): Partial<Exercise> {
  // Schema-constrained path: Genkit parsed Gemini's structured output for us.
  if (result.output && typeof result.output === 'object') {
    const candidate = result.output as { content?: { blocks?: unknown } }
    if (candidate.content && Array.isArray(candidate.content.blocks)) {
      return candidate as Partial<Exercise>
    }
  }
  // Fallback for the rare case Gemini delivered the payload as text instead
  // of a structured data part. Lets the pipeline survive a transient quirk
  // without dropping the exercise.
  return parseVariationResponseFromText(result.text)
}

/**
 * Pull pass-2's solution patch out of the adapter result.
 *
 * Since issue #1748 we intentionally omit outputSchema from the pass-2 call
 * (Gemini's responseSchema collapses the per-block array shape). We parse
 * result.text only and validate post-hoc with Zod's safeParse.
 *
 * Filters out any patch whose id doesn't match a known pass-1 question block
 * (Gemini can hallucinate extra patches).
 *
 * Normalizes legacy flat format for backward compatibility with older cached
 * responses replayed in tests.
 */
function extractPass2Patch(result: AdapterResult, pass1Output: Partial<Exercise>): Pass2Patch {
  const parsed = parseSolutionDerivationResponseFromText(result.text)
  const normalized = normalizePass2Patch(parsed as unknown as Record<string, unknown>)

  // Cross-check each returned block id against the set of question-block ids
  // actually present in pass-1 output. Drop any patch whose id doesn't match
  // a known pass-1 question block (Gemini occasionally hallucinates extras).
  const pass1Blocks =
    (pass1Output.content as { blocks?: Array<{ id: string; type: string }> } | undefined)?.blocks ??
    []
  const validIds = new Set(
    pass1Blocks
      .filter((b) => typeof b.type === 'string' && b.type.startsWith('question_'))
      .map((b) => b.id),
  )

  return {
    blocks: normalized.blocks.filter((block) => validIds.has(block.id)),
  }
}

/**
 * Normalize a raw pass-2 response to the current per-block format.
 * Handles the legacy flat format { solution, fullSolution, answer } where
 * a single solution was smeared across all question blocks (deprecated),
 * the current per-block format { blocks: [...] }, and edge cases where
 * the blocks array is missing/empty.
 */
function normalizePass2Patch(raw: Record<string, unknown>): Pass2Patch {
  // Current per-block format: already has blocks array.
  if (Array.isArray(raw.blocks)) {
    return raw as unknown as Pass2Patch
  }

  // Legacy flat format: single solution broadcast to all question blocks.
  // We still emit the { blocks: [] } shape so mergePassOutputs can handle
  // it (it will find no patches and leave blocks untouched — the correct
  // behavior for a malformed/broadcast response).
  if (raw.solution !== undefined || raw.fullSolution !== undefined || raw.answer !== undefined) {
    return { blocks: [] }
  }

  // Unknown shape — return empty blocks rather than crashing.
  return { blocks: [] }
}

function parseVariationResponseFromText(text: string): Partial<Exercise> {
  const cleaned = stripCodeFences(text)
  const parsed = JSON.parse(cleaned)

  if (!parsed.content || !Array.isArray(parsed.content.blocks)) {
    throw new SyntaxError('Response missing required content.blocks field')
  }

  return parsed as Partial<Exercise>
}

function parseSolutionDerivationResponseFromText(text: string): Pass2Patch {
  const cleaned = stripCodeFences(text)
  const parsed = JSON.parse(cleaned)

  // Validate against SolutionDerivationOutputSchema using safeParse.
  // On failure, throw a SyntaxError-compatible error so the existing
  // isJsonParseError retry envelope picks it up (same as a raw JSON parse failure).
  const result = SolutionDerivationOutputSchema.safeParse(parsed)
  if (!result.success) {
    const err = new SyntaxError(`Zod validation failed: ${result.error.message}`)
    throw err
  }

  // Zod validates the shape; the cast is safe since we know the runtime type matches.
  return result.data as Pass2Patch
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
}

function mergePassOutputs(pass1Output: Partial<Exercise>, pass2Patch: Pass2Patch): unknown[] {
  const pass1Blocks = (pass1Output.content as { blocks: unknown[] } | undefined)?.blocks ?? []

  // Build a map of block id -> patch for fast lookup.
  const patchById = new Map<string, Pass2PatchBlock>()
  for (const blockPatch of pass2Patch.blocks) {
    patchById.set(blockPatch.id, blockPatch)
  }

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

    const blockId = typeof b.id === 'string' ? b.id : String(b.id ?? '')
    const patch = patchById.get(blockId)

    const result: Record<string, unknown> = { ...b }

    // If no patch for this block id (unmatched), leave block as-is.
    if (!patch) {
      return result
    }

    if (patch.solution !== undefined) {
      result.solution = patch.solution
    }
    if (patch.fullSolution !== undefined) {
      result.fullSolution = patch.fullSolution
    }
    if (patch.answer?.correctOptionIds !== undefined) {
      const existingAnswer = (result.answer as Record<string, unknown> | undefined) ?? {}
      result.answer = {
        ...existingAnswer,
        correctOptionIds: patch.answer!.correctOptionIds,
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
  // Prefer typed signals when the underlying provider exposes them. The
  // genkit error adapter wraps Gemini rate-limit errors as LLMError with
  // code 'RATE_LIMIT_ERROR' — match that first so we don't have to guess
  // from the human-readable message.
  const code = (error as { code?: string }).code
  if (code === 'RATE_LIMIT_ERROR') return true

  // Fallback: regex anchored on substrings that genuinely indicate a quota
  // signal, not arbitrary appearances of "429" inside a URL or nested cause.
  const msg = error.message.toLowerCase()
  return (
    /\brate[\s_-]?limit(?:\s+exceeded)?\b/.test(msg) ||
    /\bresource[\s_-]?exhausted\b/.test(msg) ||
    /\bquota\s+exceeded\b/.test(msg) ||
    /\btoo\s+many\s+requests\b/.test(msg) ||
    /\b(?:status|code|http)\s*[:=]?\s*429\b/.test(msg)
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
