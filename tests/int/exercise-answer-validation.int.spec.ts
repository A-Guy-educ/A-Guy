/**
 * Integration tests: Exercise Answer Validation — two-tier flow
 * Covers: validateAnswer endpoint (DB normalization → LLM semantic fallback)
 *
 * P0 — silent wrong grading: DB check + LLM fallback never tested together.
 * LLM is mocked so tests are deterministic and fast.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'
import { validateAnswer } from '@/server/payload/endpoints/exercises/validate-answer'
import { createTestUser } from '../factories/user.factory'

// Mock LLM service — unit-test the integration chain without real API calls
vi.mock('@/infra/llm/services/answer-validation-service', () => ({
  validateWithLLM: vi.fn(),
}))

import { validateWithLLM } from '@/infra/llm/services/answer-validation-service'
const mockValidateWithLLM = vi.mocked(validateWithLLM)

let payload: Payload
let originalDatabaseUrl: string | undefined
let userId: string

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })

  const user = await createTestUser(payload)
  userId = user.id
}, 120_000)

afterAll(async () => {
  if (userId) await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()

  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error: TypeScript doesn't allow delete on process.env
    delete process.env.DATABASE_URL
  }
}, 120_000)

function makeReq(
  body: unknown,
  authenticated = true,
): PayloadRequest & { json: () => Promise<unknown> } {
  return {
    payload,
    user: authenticated ? { id: userId } : undefined,
    headers: new Headers(),
    json: async () => body,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('validateAnswer endpoint', () => {
  describe('authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      const req = makeReq(
        {
          questionId: 'q1',
          questionText: 'What is 2+2?',
          acceptedAnswers: ['4'],
          studentAnswer: '4',
        },
        false,
      )
      const res = await validateAnswer(req)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toMatch(/authentication/i)
    })
  })

  describe('input validation', () => {
    it('returns 400 for missing questionId', async () => {
      const req = makeReq({ questionText: 'Q?', acceptedAnswers: ['A'], studentAnswer: 'A' })
      const res = await validateAnswer(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 for empty acceptedAnswers array', async () => {
      const req = makeReq({
        questionId: 'q1',
        questionText: 'Q?',
        acceptedAnswers: [],
        studentAnswer: 'A',
      })
      const res = await validateAnswer(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid JSON body', async () => {
      const req = {
        payload,
        user: { id: userId },
        headers: new Headers(),
        json: async () => {
          throw new SyntaxError('bad json')
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
      const res = await validateAnswer(req)
      expect(res.status).toBe(400)
    })
  })

  describe('tier 1 — DB normalization (no LLM call)', () => {
    it('returns isCorrect=true with exact match', async () => {
      const req = makeReq({
        questionId: 'q1',
        questionText: 'What is 2+2?',
        acceptedAnswers: ['4'],
        studentAnswer: '4',
      })
      const res = await validateAnswer(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.isCorrect).toBe(true)
      expect(body.data.matchType).not.toBe('semantic')
      expect(mockValidateWithLLM).not.toHaveBeenCalled()
    })

    it('returns isCorrect=true with case-insensitive match', async () => {
      const req = makeReq({
        questionId: 'q1',
        questionText: 'What is the capital of France?',
        acceptedAnswers: ['Paris'],
        studentAnswer: 'paris',
      })
      const res = await validateAnswer(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isCorrect).toBe(true)
      expect(mockValidateWithLLM).not.toHaveBeenCalled()
    })

    it('returns isCorrect=true when student answer matches one of multiple accepted answers', async () => {
      const req = makeReq({
        questionId: 'q1',
        questionText: 'What is 1/2 as decimal?',
        acceptedAnswers: ['0.5', '0.50', '.5'],
        studentAnswer: '.5',
      })
      const res = await validateAnswer(req)
      const body = await res.json()
      expect(body.data.isCorrect).toBe(true)
      expect(mockValidateWithLLM).not.toHaveBeenCalled()
    })
  })

  describe('tier 2 — LLM semantic fallback', () => {
    it('calls LLM when DB normalization finds no match', async () => {
      mockValidateWithLLM.mockResolvedValueOnce({
        success: true,
        data: { isCorrect: true, reasoning: 'Equivalent expression' },
      })

      const req = makeReq({
        questionId: 'q2',
        questionText: 'What is the powerhouse of the cell?',
        acceptedAnswers: ['mitochondria'],
        studentAnswer: 'the energy organelle',
        questionType: 'free_response',
        questionVariant: 'conceptual',
      })
      const res = await validateAnswer(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.isCorrect).toBe(true)
      expect(body.data.matchType).toBe('semantic')
      expect(body.data.reasoning).toBeDefined()
      expect(mockValidateWithLLM).toHaveBeenCalledOnce()
    })

    it('returns LLM isCorrect=false when answer is semantically wrong', async () => {
      mockValidateWithLLM.mockResolvedValueOnce({
        success: true,
        data: { isCorrect: false, reasoning: 'Not equivalent' },
      })

      const req = makeReq({
        questionId: 'q3',
        questionText: 'What is the derivative of x²?',
        acceptedAnswers: ['2x'],
        studentAnswer: 'x³',
      })
      const res = await validateAnswer(req)
      const body = await res.json()
      expect(body.data.isCorrect).toBe(false)
      expect(body.data.matchType).toBe('semantic')
    })

    it('returns success=false and isLLMError=true when LLM fails', async () => {
      mockValidateWithLLM.mockResolvedValueOnce({
        success: false,
        error: 'LLM timeout',
      })

      const req = makeReq({
        questionId: 'q4',
        questionText: 'What is log(1)?',
        acceptedAnswers: ['0'],
        studentAnswer: 'it is undefined',
      })
      const res = await validateAnswer(req)
      expect(res.status).toBe(200) // handler returns 200 with error flag
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.isLLMError).toBe(true)
      expect(body.error).toMatch(/validate answer/i)
    })

    it('passes questionType and questionVariant through to LLM', async () => {
      mockValidateWithLLM.mockResolvedValueOnce({
        success: true,
        data: { isCorrect: true, reasoning: 'ok' },
      })

      const req = makeReq({
        questionId: 'q5',
        questionText: 'Solve for x: x + 1 = 3',
        acceptedAnswers: ['2'],
        studentAnswer: 'x=2',
        questionType: 'free_response',
        questionVariant: 'algebraic',
      })
      await validateAnswer(req)

      expect(mockValidateWithLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          questionType: 'free_response',
          questionVariant: 'algebraic',
        }),
        payload,
      )
    })
  })
})
