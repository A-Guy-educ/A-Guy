/**
 * V3 Prompt Resolver Service
 *
 * Resolves extractor prompts for V3 single-exercise conversion.
 * Validates tenant, usage, and published status.
 *
 * @fileType service
 * @domain conversion
 * @pattern prompt-resolution
 */

import type { Payload } from 'payload'
import type { Prompt } from '@/payload-types'

export interface ResolvedPrompt {
  prompt: Prompt
  version: string // `${prompt.key}:${prompt.updatedAt}`
}

/**
 * Resolve extractor prompt for a given tenant.
 *
 * @param payload - Payload instance
 * @param tenantId - Tenant ID to scope the search
 * @param promptId - Optional prompt ID override
 * @returns Resolved prompt with version marker
 * @throws Error if no valid prompt found
 */
export async function resolveExtractorPrompt(
  payload: Payload,
  tenantId: string,
  promptId?: string,
): Promise<ResolvedPrompt> {
  // If prompt ID provided, validate it
  if (promptId) {
    const prompt = await payload.findByID({
      collection: 'prompts',
      id: promptId,
      depth: 0,
    })

    if (!prompt) {
      throw new Error(`Prompt not found: ${promptId}`)
    }

    const typedPrompt = prompt as unknown as Prompt

    // Validate usage
    if (typedPrompt.usage !== 'extractor') {
      throw new Error(`Prompt ${promptId} is not an extractor prompt (usage: ${typedPrompt.usage})`)
    }

    // Validate status
    if (typedPrompt.status !== 'published') {
      throw new Error(`Prompt ${promptId} is not published (status: ${typedPrompt.status})`)
    }

    // Validate tenant
    const promptTenantId =
      typeof typedPrompt.tenant === 'object' ? typedPrompt.tenant?.id : typedPrompt.tenant
    if (promptTenantId !== tenantId) {
      throw new Error(`Prompt ${promptId} belongs to different tenant`)
    }

    // Build version string
    const updatedAt = typedPrompt.updatedAt
      ? new Date(typedPrompt.updatedAt).toISOString()
      : 'unknown'
    const version = `${typedPrompt.key}:${updatedAt}`

    return { prompt: typedPrompt, version }
  }

  // No prompt ID - find latest published extractor prompt for tenant
  const result = await payload.find({
    collection: 'prompts',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { usage: { equals: 'extractor' } },
        { status: { equals: 'published' } },
      ],
    },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
  })

  if (result.docs.length === 0) {
    throw new Error(`No published extractor prompt found for tenant ${tenantId}`)
  }

  const prompt = result.docs[0] as unknown as Prompt

  // Build version string
  const updatedAt = prompt.updatedAt ? new Date(prompt.updatedAt).toISOString() : 'unknown'
  const version = `${prompt.key}:${updatedAt}`

  return { prompt, version }
}

/**
 * Get the prompt template for extraction.
 * Returns the template field from the prompt.
 */
export function getPromptTemplate(prompt: Prompt): string {
  return prompt.template
}
