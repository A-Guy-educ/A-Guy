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
    const parsed = parseLLMResponse(result.text)
    logger.info(
      {
        hasHints: !!parsed.hints?.length,
        hasSolution: !!parsed.solution,
        hasFullSolution: !!parsed.fullSolution,
      },
      '[Support Generation] Parsed fields',
    )

    // If LLM omitted fields, retry once with explicit reminder
    if (!parsed.hints?.length || !parsed.solution || !parsed.fullSolution) {
      logger.info('[Support Generation] Missing fields, retrying with reminder')
      const retryResult = await adapter.generateChatCompletion(
        {
          system: SUPPORT_GENERATION_PROMPT,
          messages: [
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: result.text },
            {
              role: 'user',
              content:
                'Your response is missing required fields. Return the COMPLETE JSON with ALL three keys: "hints" (array of 2-3 strings), "solution" (string), "fullSolution" (string). All in Hebrew.',
            },
          ],
          model: modelConfig,
          acknowledgment: 'Retrying support generation',
        },
        payload,
      )
      logger.info({ raw: retryResult.text.slice(0, 500) }, '[Support Generation] Retry response')
      const retryParsed = parseLLMResponse(retryResult.text)
      return {
        success: true,
        data: mergeResults(parsed, retryParsed),
      }
    }

    return { success: true, data: parsed }
  } catch (error) {
    logger.error({ err: error }, '[Support Generation] LLM call failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

function parseLLMResponse(text: string): GeneratedSupport {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)
  return {
    hints: Array.isArray(parsed.hints) ? parsed.hints.map(String) : [],
    solution: parsed.solution ? String(parsed.solution) : '',
    fullSolution: parsed.fullSolution ? String(parsed.fullSolution) : '',
  }
}

function mergeResults(first: GeneratedSupport, second: GeneratedSupport): GeneratedSupport {
  return {
    hints: first.hints?.length ? first.hints : second.hints,
    solution: first.solution || second.solution,
    fullSolution: first.fullSolution || second.fullSolution,
  }
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
    modelKey,
  }
}
