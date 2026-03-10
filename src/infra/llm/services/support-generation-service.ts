/**
 * Educational Support Generation Service
 * Generates hints, solutions, and full solutions for exercise blocks
 * Server-side only — content is persisted to DB, never sent to client
 */
import type { Payload } from 'payload'
import type { AIModel, AIModelKey } from '../models'
import { getModelRegistryEntry, getProviderModelName } from '../models'
import { SUPPORT_GENERATION_PROMPT } from '../prompts/support-generation'
import { LLMProviderType } from '../providers/types'
import { buildSupportUserPrompt } from './support-generation-prompt-builder'
import { logger } from '@/infra/utils/logger'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

export interface SupportGenerationInput {
  block: ContentBlock
  exerciseTitle?: string
  targetFields: ('hints' | 'solution' | 'fullSolution')[]
}

export interface GeneratedSupport {
  hints?: string[]
  solution?: string
  fullSolution?: string
}

export interface SupportGenerationResponse {
  success: boolean
  data?: GeneratedSupport
  error?: string
}

export async function generateSupport(
  input: SupportGenerationInput,
  payload: Payload,
): Promise<SupportGenerationResponse> {
  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('SUPPORT_GENERATION')
    const userPrompt = buildSupportUserPrompt(input)

    const result = await adapter.generateChatCompletion(
      {
        system: SUPPORT_GENERATION_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        model: modelConfig,
        acknowledgment: 'Generating support content',
      },
      payload,
    )

    logger.info(
      { rawLength: result.text.length, raw: result.text.slice(0, 500) },
      '[Support Generation] Raw LLM response',
    )
    const parsed = parseLLMResponse(result.text, input.targetFields)
    logger.info(
      {
        hasHints: !!parsed.hints?.length,
        hasSolution: !!parsed.solution,
        hasFullSolution: !!parsed.fullSolution,
      },
      '[Support Generation] Parsed fields',
    )
    return { success: true, data: parsed }
  } catch (error) {
    logger.error({ err: error }, '[Support Generation] LLM call failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function parseLLMResponse(
  text: string,
  targetFields: ('hints' | 'solution' | 'fullSolution')[],
): GeneratedSupport {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  const result: GeneratedSupport = {}

  if (targetFields.includes('hints')) {
    result.hints = Array.isArray(parsed.hints) ? parsed.hints.map(String) : []
  }
  if (targetFields.includes('solution')) {
    result.solution = parsed.solution ? String(parsed.solution) : ''
  }
  if (targetFields.includes('fullSolution')) {
    result.fullSolution = parsed.fullSolution ? String(parsed.fullSolution) : ''
  }

  return result
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
  }
}
