/**
 * Google Cloud Text-to-Speech service.
 *
 * Calls the REST API with the project's GEMINI_API_KEY.
 * Key resolution: ConfigSecrets (DB) → process.env fallback.
 */

import { z } from 'zod'
import { logger } from '@/infra/utils/logger'
import { isConfigLoaded, getSecret } from '@/infra/config/runtime/runtime-config'
import type { Payload } from 'payload'

export const synthesizeRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  locale: z.enum(['en', 'he']),
})

export type SynthesizeRequest = z.infer<typeof synthesizeRequestSchema>

const VOICE_CONFIG: Record<string, { languageCode: string; name: string; ssmlGender: string }> = {
  he: { languageCode: 'he-IL', name: 'he-IL-Neural2-A', ssmlGender: 'FEMALE' },
  en: { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
}

const TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

async function getApiKey(payload?: Payload): Promise<string> {
  if (payload && !isConfigLoaded()) {
    const { loadRuntimeConfig } = await import('@/infra/config/runtime/runtime-config')
    await loadRuntimeConfig(payload)
  }

  try {
    const secret = getSecret('GEMINI_API_KEY', { throwIfNotFound: false })
    if (secret) return secret
  } catch {
    // ConfigSecrets not available, fall through to env
  }

  const envValue = process.env.GEMINI_API_KEY
  if (!envValue) {
    throw new Error('[TTS] GEMINI_API_KEY not found in ConfigSecrets or environment')
  }
  return envValue
}

/**
 * Synthesize speech from text using Google Cloud TTS.
 * Returns base64-encoded MP3 audio.
 */
export async function synthesizeSpeech(
  text: string,
  locale: 'en' | 'he',
  payload?: Payload,
): Promise<string> {
  const apiKey = await getApiKey(payload)
  const voice = VOICE_CONFIG[locale]

  const body = {
    input: { text },
    voice: {
      languageCode: voice.languageCode,
      name: voice.name,
      ssmlGender: voice.ssmlGender,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.85,
    },
  }

  const response = await fetch(`${TTS_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error(
      { status: response.status, locale, textLength: text.length },
      `[TTS] Google Cloud TTS API error: ${errorText}`,
    )
    throw new Error(`Google Cloud TTS API returned ${response.status}`)
  }

  const data = await response.json()
  return data.audioContent
}
