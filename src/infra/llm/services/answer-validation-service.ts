/**
 * Answer validation service using LLM for semantic equivalence
 * Server-side only — called as fallback when DB normalization fails
 */
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../models'
import { getModelRegistryEntry, getProviderModelName } from '../models'
import { ANSWER_VALIDATION_PROMPT } from '../prompts/answer-validation'
import { LLMProviderType } from '../providers/types'
import { logger } from '@/infra/utils/logger'

export interface LLMValidationInput {
  questionText: string
  acceptedAnswers: string[]
  studentAnswer: string
}

export interface LLMValidationResult {
  isCorrect: boolean
  reasoning?: string
}

export interface LLMValidationResponse {
  success: boolean
  data?: LLMValidationResult
  error?: string
}

export async function validateWithLLM(
  input: LLMValidationInput,
  payload: Payload,
): Promise<LLMValidationResponse> {
  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('ANSWER_VALIDATION')

    const userPrompt = buildUserPrompt(input)

    const result = await adapter.generateChatCompletion(
      {
        system: ANSWER_VALIDATION_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        model: modelConfig,
        acknowledgment: 'Validating answer',
      },
      payload,
    )

    const parsed = parseLLMResponse(result.text)
    return { success: true, data: parsed }
  } catch (error) {
    logger.error({ err: error }, '[Answer Validation] LLM call failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function buildUserPrompt(input: LLMValidationInput): string {
  return [
    `Question: "${input.questionText}"`,
    `Accepted Answers: ${JSON.stringify(input.acceptedAnswers)}`,
    `Student Answer: "${input.studentAnswer}"`,
    '',
    'Is the student answer semantically equivalent to any accepted answer?',
  ].join('\n')
}

function parseLLMResponse(text: string): LLMValidationResult {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  return {
    isCorrect: Boolean(parsed.isCorrect),
    reasoning: parsed.reasoning,
  }
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
  }
}
