/**
 * V2 Vision Exercise Start Detection Service
 *
 * Detects exercise start positions and content region bounds on PDF pages.
 * Uses Vision LLM to identify where each exercise begins (Y-coordinate),
 * and the content region boundaries (excluding headers/footers).
 *
 * @fileType service
 * @domain ai
 * @pattern vision-detection, pdf-processing
 */

import type { Payload } from 'payload'
import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
} from '@/infra/llm/providers/factory'

/**
 * A detected exercise start position on a single page.
 */
export interface ExerciseStart {
  label: string
  startY: number // normalized 0-1
}

/**
 * Detection result for a single page.
 */
export interface PageDetectionResult {
  contentStartY: number // normalized 0-1, below header
  contentEndY: number // normalized 0-1, above footer
  continuesFromPrevious: boolean
  exercises: ExerciseStart[]
}

/**
 * Vision prompt that asks for exercise start positions and content bounds only.
 * Much simpler than asking for full bounding boxes — the LLM only needs to
 * identify WHERE each exercise begins, not where it ends.
 */
/**
 * Maximum exercises expected per page. If the LLM returns more,
 * it's likely over-detecting sub-questions as exercises.
 */
const MAX_EXERCISES_PER_PAGE = 4

const VISION_PROMPT = `You are analyzing a scanned math exam page. Your task is to find ONLY the top-level exercise numbers.

CRITICAL RULES:
- A "top-level exercise" has a MAIN exercise number like: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
  Written as: "1.", "2.", ".1", ".2" (in Hebrew RTL), "שאלה 1", "שאלה 2"
- Sub-parts like א, ב, ג, a, b, c, (1), (2), i, ii are NOT exercises — IGNORE THEM
- Most exam pages have only 1-3 top-level exercises. If you find more than 4, you are probably counting sub-parts as exercises — re-examine.
- An answer key / solution page is NOT an exercise page — return empty exercises array

Return ONLY a JSON object:
{
  "contentStartY": 0.06,
  "contentEndY": 0.93,
  "continuesFromPrevious": false,
  "exercises": [
    { "label": "1", "startY": 0.08 },
    { "label": "2", "startY": 0.55 }
  ]
}

Y values are normalized 0-1 (0 = top of page, 1 = bottom).
contentStartY/contentEndY = bounds of actual content (exclude headers, footers, page numbers).
exercises = ONLY top-level exercise starts. Label must be the exercise NUMBER only (e.g. "1", "2", "3").
continuesFromPrevious = true if the page starts mid-exercise with no new exercise number at the top.
If the page is an answer key or has no exercises, return empty exercises array.
Do not include markdown formatting — raw JSON only.
`

/**
 * Detect exercise start positions and content bounds on a page image.
 */
export async function detectExerciseStarts(
  pageImageBuffer: Buffer,
  payload: Payload,
): Promise<PageDetectionResult> {
  const provider = await getLLMProvider(payload)
  const providerType = await getProviderTypeFromEnv(payload)
  const modelConfig = getProviderModelConfig(providerType, 'PDF_TO_EXERCISE')

  const base64Image = pageImageBuffer.toString('base64')

  const result = await provider.generateMultimodalCompletion(
    {
      prompt: VISION_PROMPT,
      model: modelConfig,
      attachments: [
        {
          data: base64Image,
          mimeType: 'image/png',
        },
      ],
    },
    payload,
  )

  return parseDetectionResponse(result.text)
}

/**
 * Parse LLM response into structured detection result.
 */
function parseDetectionResponse(response: string): PageDetectionResult {
  const fallback: PageDetectionResult = {
    contentStartY: 0,
    contentEndY: 1,
    continuesFromPrevious: false,
    exercises: [],
  }

  try {
    const cleaned = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    const contentStartY = clamp01(parsed.contentStartY ?? 0)
    const contentEndY = clamp01(parsed.contentEndY ?? 1)
    const continuesFromPrevious = parsed.continuesFromPrevious === true

    const exercises: ExerciseStart[] = []
    if (Array.isArray(parsed.exercises)) {
      for (const item of parsed.exercises) {
        if (typeof item.startY !== 'number') continue
        exercises.push({
          label: typeof item.label === 'string' ? item.label : '',
          startY: clamp01(item.startY),
        })
      }
    }

    // Sort by startY (top to bottom)
    exercises.sort((a, b) => a.startY - b.startY)

    // Guard: if LLM over-detected (likely counting sub-questions), keep only the first few
    if (exercises.length > MAX_EXERCISES_PER_PAGE) {
      console.warn(
        `[V2 Vision] LLM returned ${exercises.length} exercises (max ${MAX_EXERCISES_PER_PAGE}), likely over-detecting. Truncating.`,
      )
      exercises.length = MAX_EXERCISES_PER_PAGE
    }

    return { contentStartY, contentEndY, continuesFromPrevious, exercises }
  } catch (error) {
    console.error('[V2 Vision] Failed to parse detection response:', error)
    console.debug('[V2 Vision] Raw response:', response)
    return fallback
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}
