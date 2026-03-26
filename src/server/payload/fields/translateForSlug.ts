import { OpenAI } from 'openai'

import { logger } from '@/infra/utils/logger'

let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

const HEBREW_REGEX = /[\u0590-\u05FF]/

/**
 * Returns true if the input contains any Hebrew characters.
 */
export function containsHebrew(input: string): boolean {
  return HEBREW_REGEX.test(input)
}

/**
 * Translate a Hebrew title to English for use as a URL slug.
 * Uses gpt-4o-mini for cost efficiency (~0.01¢ per call).
 * Returns null on failure so callers can fall back to transliteration.
 */
export async function translateHebrewForSlug(title: string): Promise<string | null> {
  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'Translate the following Hebrew text to English. Return ONLY the English translation, nothing else. Keep it concise — this will be used as a URL slug.',
        },
        { role: 'user', content: title },
      ],
    })

    const translation = response.choices[0]?.message?.content?.trim()
    if (!translation) return null

    return translation
  } catch (error) {
    logger.warn(
      { title, err: error instanceof Error ? error : String(error) },
      'Failed to translate Hebrew title for slug, falling back to transliteration',
    )
    return null
  }
}
