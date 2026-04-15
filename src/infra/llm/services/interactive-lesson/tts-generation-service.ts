/**
 * Text-to-Speech generation service using OpenAI TTS API.
 * Generates audio narration for interactive lesson steps.
 *
 * Requires OPENAI_API_KEY environment variable.
 * Uses tts-1 model with 'alloy' voice (supports Hebrew).
 */
import { logger } from '@/infra/utils/logger/logger'

const TTS_API_URL = 'https://api.openai.com/v1/audio/speech'
const TTS_MODEL = 'tts-1'
const TTS_VOICE = 'alloy'

export interface TtsInput {
  text: string
  /** Speech speed multiplier (0.25 to 4.0) */
  speed?: number
}

export interface TtsResult {
  /** Base64-encoded MP3 audio */
  audioBase64: string
  /** Duration estimate in seconds (approximate) */
  estimatedDurationSeconds: number
}

/**
 * Generate speech audio from text using OpenAI TTS.
 * Returns base64-encoded MP3 audio data.
 */
export async function generateSpeech(input: TtsInput): Promise<TtsResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: input.text,
      voice: TTS_VOICE,
      response_format: 'mp3',
      speed: input.speed ?? 1.0,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    logger.error({ status: response.status, errorBody }, 'TTS API request failed')
    throw new Error(`TTS generation failed: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const audioBase64 = Buffer.from(arrayBuffer).toString('base64')

  // Rough duration estimate: MP3 at 32kbps ≈ 4KB/sec
  const estimatedDurationSeconds = Math.max(1, arrayBuffer.byteLength / 4000)

  return { audioBase64, estimatedDurationSeconds }
}

/**
 * Generate TTS audio for all steps of an interactive lesson.
 * Returns an array of base64 audio data, one per step.
 * If TTS fails for any step, returns null for that step (graceful degradation).
 */
export async function generateStepAudio(
  steps: Array<{ narration: string }>,
): Promise<Array<TtsResult | null>> {
  const results = await Promise.allSettled(
    steps.map((step) => generateSpeech({ text: step.narration })),
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value
    logger.warn({ stepIndex: index, reason: result.reason }, 'TTS failed for step')
    return null
  })
}
