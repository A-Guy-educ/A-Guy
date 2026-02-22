import { logger } from '@/infra/utils/logger'
import { nanoid } from 'nanoid'
import type { Tenant } from '@/payload-types'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

const log = logger.child({ service: 'exercise-conversion-helpers' })

/**
 * v2.1 Fix 5: INVARIANT - Block ID Enrichment
 *
 * After Zod schema validation of extractor output:
 * 1. Raw exercises have optional block IDs (RawExtractedExercise)
 * 2. ALWAYS call enrichBlockIds() to generate missing IDs via nanoid()
 * 3. Result is ExerciseExtractedEnriched with guaranteed block IDs
 * 4. Only enriched exercises are passed to hashing/persistence
 */
export function enrichBlockIds(raw: {
  title: string
  blocks: Array<{
    type: string
    id?: string
    format?: string
    value?: string
    latex?: string
    renderMode?: string
  }>
  orderInSegment: number
}): {
  title: string
  blocks: Array<{
    type: string
    id: string
    format?: string
    value?: string
    latex?: string
    renderMode?: string
  }>
  orderInSegment: number
} {
  return {
    ...raw,
    blocks: raw.blocks.map((block) => ({
      ...block,
      id: block.id || nanoid(),
      renderMode: block.type === 'latex' ? block.renderMode || 'block' : undefined,
    })),
  }
}

/**
 * Build Jobs REST API "where" query for Status Panel.
 * Pure function - no IO.
 */
export function buildJobsWhereQuery(lessonId: string, mediaId: string): object {
  return {
    and: [
      { taskSlug: { equals: 'pdf_to_exercises' } },
      { 'input.ctx.lessonId': { equals: lessonId } },
      { 'input.ctx.sourceDocId': { equals: mediaId } },
    ],
  }
}

/**
 * Validate prompt document for expected usage and tenant.
 * Returns void or throws typed error.
 */
export function validatePromptForUsageAndTenant(
  promptDoc: { status: string; usage: string; tenant: Tenant },
  expectedUsage: 'extractor' | 'verifier',
  lessonTenantId: string,
): void {
  if (promptDoc.status !== 'published') {
    throw { code: 'PROMPT_NOT_PUBLISHED', message: `Prompt is not published` }
  }
  if (promptDoc.usage !== expectedUsage) {
    throw { code: 'PROMPT_USAGE_MISMATCH', message: `Prompt usage is ${promptDoc.usage}` }
  }
  const promptTenantId =
    typeof promptDoc.tenant === 'object' ? promptDoc.tenant.id : promptDoc.tenant
  if (promptTenantId !== lessonTenantId) {
    throw { code: 'PROMPT_TENANT_MISMATCH', message: `Prompt tenant mismatch` }
  }
}

/**
 * Atomic claim Mongo query - returns query filter for findOneAndUpdate.
 */
export function atomicClaimJobQuery(now: Date): object {
  return {
    $or: [
      { taskSlug: 'pdf_to_exercises', status: 'queued' },
      {
        taskSlug: 'pdf_to_exercises',
        status: 'running',
        lockExpiresAt: { $exists: true, $lt: now },
      },
    ],
  }
}

/**
 * Atomic claim Mongo update - returns update operations.
 */
export function atomicClaimJobUpdate(now: Date, lockTimeoutMs: number): object {
  const expiresAt = new Date(now.getTime() + lockTimeoutMs)
  return {
    $set: { status: 'running', claimedAt: now, lockExpiresAt: expiresAt },
  }
}

/**
 * Normalize exercise for hashing - pure version of toExerciseInput.
 */
export function normalizeExerciseForHash(extracted: {
  title: string
  blocks: Array<{ type: string; value?: string; latex?: string }>
}): { title: string; blocks: Array<{ blockType: string; content?: string; latex?: string }> } {
  return {
    title: extracted.title.trim().replace(/\s+/g, ' '),
    blocks: extracted.blocks.map((b) => ({
      blockType: b.type,
      content: b.type === 'rich_text' ? b.value?.trim().replace(/\s+/g, ' ') : undefined,
      latex: b.type === 'latex' ? b.latex : undefined,
    })),
  }
}

/**
 * Parse extractor response - pure string parsing.
 * v2.2 Fix: Handle malformed JSON with escape sequence issues from LLM.
 */
export function parseExtractorResponseText(responseText: string): unknown[] {
  try {
    const jsonMatch =
      responseText.match(/\[[\s\S]*\]/) || responseText.match(/```json\n([\s\S]*?)\n```/)
    const jsonStr = jsonMatch?.[1] || jsonMatch?.[0] || responseText

    // First attempt: direct parse
    try {
      return JSON.parse(jsonStr)
    } catch {
      // Second attempt: unescape double-backslashes (LLM sometimes double-escapes)
      const unescaped = jsonStr.replace(/\\\\/g, '\\')
      try {
        return JSON.parse(unescaped)
      } catch {
        // Third attempt: try removing leading/trailing whitespace that might break parsing
        const trimmed = jsonStr.trim()
        try {
          return JSON.parse(trimmed)
        } catch {
          // Fourth attempt: try to fix common issues - remove trailing commas
          const fixed = trimmed.replace(/,\s*([}\]\]])/g, '$1')
          try {
            return JSON.parse(fixed)
          } catch (finalError) {
            log.error(
              {
                originalLength: responseText.length,
                snippet: responseText.substring(0, 200),
                jsonMatchLength: jsonStr.length,
              },
              '[parseExtractorResponseText] Failed to parse',
            )
            throw {
              code: 'PARSE_EXTRACTOR_RESPONSE_FAILED',
              message: `Failed to parse extractor response: ${finalError}`,
            }
          }
        }
      }
    }
  } catch (error) {
    // Re-throw as structured error
    if (error && typeof error === 'object' && 'code' in error) {
      throw error
    }
    throw {
      code: 'PARSE_EXTRACTOR_RESPONSE_FAILED',
      message: `Failed to parse extractor response: ${error}`,
    }
  }
}

/**
 * Parse verifier response - pure string parsing.
 * v2.2 Fix: Handle malformed JSON with escape sequence issues from LLM.
 */
export function parseVerifierResponseText(responseText: string): {
  valid: boolean
  reason?: string
} {
  try {
    const jsonMatch =
      responseText.match(/\{[\s\S]*\}/) || responseText.match(/```json\n([\s\S]*?)\n```/)
    const jsonStr = jsonMatch?.[1] || jsonMatch?.[0] || responseText

    // First attempt: direct parse
    try {
      return JSON.parse(jsonStr)
    } catch {
      // Second attempt: unescape double-backslashes
      const unescaped = jsonStr.replace(/\\\\/g, '\\')
      try {
        return JSON.parse(unescaped)
      } catch {
        // Third attempt: trim and try again
        const trimmed = jsonStr.trim()
        try {
          return JSON.parse(trimmed)
        } catch (finalError) {
          log.error(
            { originalLength: responseText.length, snippet: responseText.substring(0, 200) },
            '[parseVerifierResponseText] Failed to parse',
          )
          throw {
            code: 'PARSE_VERIFIER_RESPONSE_FAILED',
            message: `Failed to parse verifier response: ${finalError}`,
          }
        }
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error
    }
    throw {
      code: 'PARSE_VERIFIER_RESPONSE_FAILED',
      message: `Failed to parse verifier response: ${error}`,
    }
  }
}

/**
 * Adapter: Convert ExerciseExtractedEnriched to ExerciseInput for hashing
 */
export function toExerciseInput(extracted: {
  title: string
  blocks: Array<{
    type: string
    id: string
    value?: string
    format?: string
    latex?: string
    renderMode?: string
    question?: string
    options?: string[]
    correctAnswer?: number
    sampleAnswer?: string
  }>
}): { title: string; blocks: Array<{ blockType: string; content?: string; latex?: string }> } {
  return {
    title: extracted.title,
    blocks: extracted.blocks.map((b) => {
      if (b.type === 'rich_text') {
        return { blockType: 'rich_text', content: b.value }
      }
      if (b.type === 'latex') {
        return { blockType: 'latex', latex: b.latex }
      }
      // For question blocks, we'll include basic info for hashing
      return { blockType: b.type }
    }),
  }
}

/**
 * Normalize exercise for stable content identity - applied BEFORE enrichment.
 * This ensures consistent hashing regardless of nanoid variations in block IDs.
 * Only collapses whitespace - does NOT modify operator spacing to preserve meaning.
 */
export function normalizeExerciseInput(extracted: {
  title: string
  blocks: Array<{
    type: string
    id?: string
    value?: string
    format?: string
    latex?: string
    renderMode?: string
  }>
}): { title: string; blocks: Array<{ blockType: string; content?: string; latex?: string }> } {
  return {
    title: extracted.title.trim().replace(/\s+/g, ' '),
    blocks: extracted.blocks.map((b) => {
      if (b.type === 'rich_text') {
        return {
          blockType: 'rich_text',
          content: b.value?.trim().replace(/\s+/g, ' '),
        }
      }
      if (b.type === 'latex') {
        return {
          blockType: 'latex',
          // Normalize LaTeX whitespace: collapse multiple spaces, trim
          latex: b.latex?.trim().replace(/\s+/g, ' '),
        }
      }
      return { blockType: b.type }
    }),
  }
}

/**
 * Adapter: Convert ExerciseExtractedEnriched to Payload content format
 * Maps to ContentBlockSchema union (LatexBlockSchema, RichTextBlockSchema, etc.)
 */
export function toPayloadContent(extracted: {
  title: string
  blocks: Array<{
    type: string
    id: string
    value?: string
    format?: string
    latex?: string
    renderMode?: string
    question?: string
    options?: string[]
    correctAnswer?: number
    sampleAnswer?: string
  }>
}): { blocks: ContentBlock[] } {
  return {
    blocks: extracted.blocks.map((b) => {
      if (b.type === 'latex') {
        return {
          id: b.id,
          type: 'latex' as const,
          latex: b.latex,
          renderMode: b.renderMode || 'block',
        }
      }
      if (b.type === 'rich_text') {
        return {
          id: b.id,
          type: 'rich_text' as const,
          format: b.format || 'md-math-v1',
          value: b.value,
          mediaIds: [],
        }
      }
      // For question blocks, return as-is (they should already be in correct format)
      return b
    }) as ContentBlock[],
  }
}
