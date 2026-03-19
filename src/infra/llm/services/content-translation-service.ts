/**
 * Content Translation Service
 *
 * Translates exercise content blocks between languages using LLM.
 * Part of the Clone-and-Translate system for educational content localization.
 */
import type { Payload } from 'payload'

import type { AIModel, AIModelKey } from '../models'
import type { ContentBlock, ContentData } from '@/server/payload/collections/Exercises/types'
import type { ContentLocale } from '@/server/payload/fields/contentLocale'

import { getModelRegistryEntry, getProviderModelName } from '../models'
import { CONTENT_TRANSLATION_PROMPT } from '../prompts/content-translation'
import { LLMProviderType } from '../providers/types'
import { logger } from '@/infra/utils/logger'

export interface TranslationInput {
  blocks: ContentBlock[]
  sourceLocale: ContentLocale
  targetLocale: ContentLocale
  glossary?: GlossaryEntry[]
  customSystemPrompt?: string
}

export interface GlossaryEntry {
  source: string
  target: string
}

export interface TranslationResponse {
  success: boolean
  data?: ContentData
  error?: string
}

const LOCALE_LABELS: Record<ContentLocale, string> = {
  he: 'Hebrew',
  en: 'English',
}

export async function translateContentBlocks(
  input: TranslationInput,
  payload: Payload,
): Promise<TranslationResponse> {
  const { blocks, sourceLocale, targetLocale, glossary, customSystemPrompt } = input

  if (blocks.length === 0) {
    return { success: true, data: { blocks: [] } }
  }

  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('CONTENT_TRANSLATION')

    const systemPrompt = customSystemPrompt || CONTENT_TRANSLATION_PROMPT
    const userPrompt = buildTranslationPrompt(blocks, sourceLocale, targetLocale, glossary)

    const result = await adapter.generateChatCompletion(
      {
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        model: modelConfig,
        acknowledgment: `Translating ${blocks.length} blocks from ${sourceLocale} to ${targetLocale}`,
      },
      payload,
    )

    logger.info(
      { rawLength: result.text.length, blockCount: blocks.length },
      '[Content Translation] LLM response received',
    )

    const parsed = parseTranslationResponse(result.text)

    if (parsed.blocks.length !== blocks.length) {
      logger.warn(
        {
          expected: blocks.length,
          received: parsed.blocks.length,
        },
        '[Content Translation] Block count mismatch, retrying',
      )
      return retryTranslation(adapter, modelConfig, userPrompt, result.text, blocks.length, payload, systemPrompt)
    }

    return { success: true, data: parsed }
  } catch (error) {
    logger.error({ err: error }, '[Content Translation] Failed')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Translation failed',
    }
  }
}

function buildTranslationPrompt(
  blocks: ContentBlock[],
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  glossary?: GlossaryEntry[],
): string {
  const parts: string[] = [
    `Translate from **${LOCALE_LABELS[sourceLocale]}** to **${LOCALE_LABELS[targetLocale]}**.`,
    '',
    `Input blocks (${blocks.length} total):`,
    '```json',
    JSON.stringify({ blocks }, null, 2),
    '```',
  ]

  if (glossary?.length) {
    parts.push(
      '',
      'Glossary (use these translations consistently):',
      ...glossary.map((g) => `- "${g.source}" → "${g.target}"`),
    )
  }

  return parts.join('\n')
}

function parseTranslationResponse(text: string): ContentData {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  if (!Array.isArray(parsed.blocks)) {
    throw new Error('Response missing "blocks" array')
  }

  return { blocks: parsed.blocks as ContentBlock[] }
}

async function retryTranslation(
  adapter: Awaited<
    ReturnType<typeof import('../genkit/adapters/unified-adapter').createGenkitUnifiedAdapter>
  >,
  modelConfig: AIModel,
  originalPrompt: string,
  previousResponse: string,
  expectedCount: number,
  payload: Payload,
  systemPrompt: string = CONTENT_TRANSLATION_PROMPT,
): Promise<TranslationResponse> {
  const retryResult = await adapter.generateChatCompletion(
    {
      system: systemPrompt,
      messages: [
        { role: 'user', content: originalPrompt },
        { role: 'assistant', content: previousResponse },
        {
          role: 'user',
          content: `Your response has the wrong number of blocks. The input has exactly ${expectedCount} blocks. Return exactly ${expectedCount} translated blocks in the same order with the same IDs.`,
        },
      ],
      model: modelConfig,
      acknowledgment: 'Retrying translation (block count mismatch)',
    },
    payload,
  )

  const parsed = parseTranslationResponse(retryResult.text)
  return { success: true, data: parsed }
}

/**
 * Translate plain text strings (titles, descriptions).
 * Returns the original text on failure.
 */
export async function translateText(
  texts: string[],
  sourceLocale: ContentLocale,
  targetLocale: ContentLocale,
  payload: Payload,
): Promise<string[]> {
  if (texts.length === 0) return []

  try {
    const { createGenkitUnifiedAdapter } = await import('../genkit/adapters/unified-adapter')
    const adapter = await createGenkitUnifiedAdapter(payload)
    const modelConfig = resolveModelConfig('CONTENT_TRANSLATION')

    const prompt = [
      `Translate from ${LOCALE_LABELS[sourceLocale]} to ${LOCALE_LABELS[targetLocale]}.`,
      'Return a JSON array of translated strings in the same order.',
      'Keep mathematical terms accurate. Return ONLY the JSON array, no explanation.',
      '',
      'Input:',
      JSON.stringify(texts),
    ].join('\n')

    const result = await adapter.generateChatCompletion(
      {
        system: 'You are a translator. Return only a JSON array of translated strings.',
        messages: [{ role: 'user', content: prompt }],
        model: modelConfig,
        acknowledgment: `Translating ${texts.length} text strings`,
      },
      payload,
    )

    const cleaned = result.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length === texts.length) {
      return parsed.map(String)
    }
    return texts
  } catch {
    return texts
  }
}

function resolveModelConfig(modelKey: AIModelKey): AIModel {
  const entry = getModelRegistryEntry(modelKey)
  return {
    name: getProviderModelName(LLMProviderType.GEMINI, modelKey),
    ...entry,
  }
}
