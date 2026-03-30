import { GoogleGenerativeAI } from '@google/generative-ai'

import { logger } from '@/infra/utils/logger'

let gemini: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!gemini) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }
    gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return gemini
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
 * Uses Gemini Flash Lite for cost efficiency.
 * Returns null on failure so callers can fall back to transliteration.
 */
export async function translateHebrewForSlug(title: string): Promise<string | null> {
  try {
    const client = getGeminiClient()
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 100,
      },
    })

    const result = await model.generateContent(
      'Translate the following Hebrew text to English. Return ONLY the English translation, nothing else. Keep it concise — this will be used as a URL slug.\n\n' +
        title,
    )

    const translation = result.response.text()?.trim()
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
