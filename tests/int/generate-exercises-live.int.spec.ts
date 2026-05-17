/**
 * LIVE smoke: generate-exercises against the real MiniMax model.
 *
 * Skipped unless RUN_LIVE_LLM=1 AND OpenAI-compatible creds are present.
 * Asserts loose invariants only (shape/count) — never exact content,
 * since model output is non-deterministic.
 *
 * Run: RUN_LIVE_LLM=1 pnpm exec vitest run \
 *   tests/int/generate-exercises-live.int.spec.ts --config ./vitest.config.mts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import {
  generateExercises,
  type ExerciseType,
} from '@/infra/llm/services/exercise-generation-service'

const LIVE =
  process.env.RUN_LIVE_LLM === '1' &&
  !!process.env.OPENAI_COMPATIBLE_API_KEY &&
  !!process.env.OPENAI_COMPATIBLE_BASE_URL

describe.skipIf(!LIVE)('generate-exercises (LIVE MiniMax smoke)', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  }, 120_000)

  afterAll(async () => {
    await payload.db?.destroy?.()
  })

  const types: ExerciseType[] = ['mcq', 'true_false', 'free_response', 'table', 'mixed']

  for (const exerciseType of types) {
    it(
      `produces a valid batch for type "${exerciseType}"`,
      async () => {
        const res = await generateExercises(
          {
            lessonTitle: 'משוואות ממעלה ראשונה',
            chapterTitle: 'אלגברה',
            courseTitle: 'מתמטיקה כיתה ז׳',
            adminPrompt: 'צור תרגילים על פתרון משוואות פשוטות',
            exerciseType,
            count: 3,
          },
          payload,
        )

        expect(res.success, res.error).toBe(true)
        expect(Array.isArray(res.data)).toBe(true)
        expect(res.data!.length).toBeGreaterThan(0)

        for (const ex of res.data!) {
          // Required-field invariant — mirrors parseLLMResponse contract
          expect(ex.prompt?.trim().length).toBeGreaterThan(0)
          expect(ex.hint?.trim().length).toBeGreaterThan(0)
          expect(ex.solution?.trim().length).toBeGreaterThan(0)
          expect(ex.fullSolution?.trim().length).toBeGreaterThan(0)
          expect(['question_select', 'question_free_response', 'question_table']).toContain(ex.type)

          if (ex.type === 'question_select') {
            expect(ex.options?.length).toBeGreaterThanOrEqual(2)
            expect(ex.options!.some((o) => o.correct)).toBe(true)
          }
          if (ex.type === 'question_table') {
            expect(ex.table?.headers?.length).toBeGreaterThan(0)
          }
        }
      },
      90_000, // real network call — generous per-test timeout
    )
  }
})
