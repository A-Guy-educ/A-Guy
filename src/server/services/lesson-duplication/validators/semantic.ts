/**
 * Semantic Validator — single-exercise LLM call for content quality.
 *
 * Skipped for:
 *  - level=none (deep clone, no AI variation)
 *  - exercises produced by the 'script' strategy
 *
 * Calls LLM with a structured prompt asking whether the exercise content
 * is semantically valid (coherent question, plausible distractors, etc.).
 * Returns { ok: true } on LLM approval, { ok: false, reasons: string[] } otherwise.
 */

import type { Payload } from 'payload'
import {
  getLLMProvider,
  getProviderModelConfig,
  getProviderTypeFromEnv,
} from '@/infra/llm/providers/factory'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'

/** Match the variation service's per-call timeout so a stuck LLM can't pin a duplication record in `running`. */
const SEMANTIC_LLM_TIMEOUT_MS = 60_000

function withTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`Semantic validator ${stage} timed out after ${SEMANTIC_LLM_TIMEOUT_MS}ms`),
        ),
      SEMANTIC_LLM_TIMEOUT_MS,
    )
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export const SEMANTIC_FAILURE_CODE = 'SEMANTIC_MISMATCH' as const

export type SemanticValidationResult =
  | { ok: true; reasons?: string[] }
  | { ok: false; reasons: string[] }

const SEMANTIC_PROMPT = `You are a strict exercise quality reviewer.

Evaluate the following exercise content for a math or science question.
An exercise is semantically valid if:
1. The question/prompt is clear and unambiguous
2. All answer options (if multiple choice) are plausible and relevant
3. The hint and solution are present and helpful
4. The content does not contain nonsensical text, garbled characters, or obvious hallucinations
5. The variation makes sense given the context (not random or contradictory)

Return ONLY a JSON object with this exact schema:
{
  "ok": true,
  "reasons": []
}
OR
{
  "ok": false,
  "reasons": ["reason 1", "reason 2", ...]
}

Exercise content to evaluate:
`

function serializeBlocksForPrompt(blocks: ContentBlock[]): string {
  return JSON.stringify(blocks, null, 2)
}

/**
 * Validate a single exercise's content semantically via LLM.
 *
 * @param blocks   The exercise content blocks
 * @param level    Duplication level (skipped for 'none')
 * @param strategy Strategy that produced this exercise ('script' or 'ai')
 * @param payload  Payload instance for LLM provider access
 * @returns        { ok: true } | { ok: false, reasons: string[] }
 */
export async function validateExerciseSemantic(
  blocks: ContentBlock[],
  level: 'none' | 'light' | 'medium' | 'deep',
  strategy: 'script' | 'ai',
  payload: Payload,
): Promise<SemanticValidationResult> {
  // Skip for level=none (deep clone, no AI involved)
  if (level === 'none') {
    return { ok: true, reasons: [] }
  }

  // Skip for script strategy (deterministic, no AI hallucination risk)
  if (strategy === 'script') {
    return { ok: true, reasons: [] }
  }

  // Use the deterministic variation model (temp 0, gemini-3.1-pro) for the
  // semantic review pass. Previously this used EXERCISE_CHAT (flash-lite) which
  // gave a cheaper but weaker reviewer judging a much stronger generator.
  const provider = await getLLMProvider(payload)
  const providerType = await getProviderTypeFromEnv(payload)
  const modelConfig = getProviderModelConfig(
    providerType,
    'LESSON_DUPLICATION_VARIATION_DETERMINISTIC',
  )

  const contentJson = serializeBlocksForPrompt(blocks)

  let result: { text: string }
  try {
    result = await withTimeout(
      provider.generateChatCompletion(
        {
          system:
            'You are a strict exercise quality reviewer. Return ONLY valid JSON matching the specified schema.',
          messages: [
            {
              role: 'user',
              content: `${SEMANTIC_PROMPT}${contentJson}`,
            },
          ],
          model: modelConfig,
          acknowledgment: 'I will return only valid JSON.',
        },
        payload,
      ),
      'review',
    )
  } catch (err) {
    return {
      ok: false,
      reasons: [err instanceof Error ? err.message : 'Semantic validator LLM call failed'],
    }
  }

  try {
    // Try to extract JSON from the response text (may be wrapped in markdown code fences)
    let jsonText = result.text.trim()
    const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim()
    }
    const parsed = JSON.parse(jsonText) as { ok: boolean; reasons?: string[] }

    if (parsed.ok === true) {
      return { ok: true, reasons: [] }
    }
    return {
      ok: false,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : ['Semantic validation failed'],
    }
  } catch {
    // LLM returned non-JSON — treat as failure
    return {
      ok: false,
      reasons: [`LLM returned non-JSON response: ${result.text.slice(0, 200)}`],
    }
  }
}
