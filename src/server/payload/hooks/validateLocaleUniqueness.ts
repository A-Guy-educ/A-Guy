/**
 * Uniqueness hooks for (slug, locale) and (promptKey, locale) pairs
 *
 * MongoDB compound uniqueness enforced via beforeChange hooks.
 */
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

/**
 * Factory: enforces unique (slug, locale) per collection
 */
export function enforceSlugLocaleUniqueness(collectionSlug: string): CollectionBeforeChangeHook {
  return async ({ data, req, operation, originalDoc }) => {
    const slug = data?.slug ?? originalDoc?.slug
    const locale = data?.locale ?? originalDoc?.locale
    if (!slug || !locale) return data

    const selfId = operation === 'update' ? originalDoc?.id : undefined

    const existing = await req.payload.find({
      collection: collectionSlug as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      where: {
        and: [
          { slug: { equals: slug } },
          { locale: { equals: locale } },
          ...(selfId ? [{ id: { not_equals: selfId } }] : []),
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      throw new APIError(
        `A document with slug '${slug}' and locale '${locale}' already exists in ${collectionSlug}`,
        400,
      )
    }

    return data
  }
}

/**
 * Enforces unique (promptKey, locale) on Prompts
 */
export const enforcePromptKeyLocaleUniqueness: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const promptKey = data?.promptKey ?? originalDoc?.promptKey
  const locale = data?.locale ?? originalDoc?.locale
  if (!promptKey || !locale) return data

  const selfId = operation === 'update' ? originalDoc?.id : undefined

  const existing = await req.payload.find({
    collection: 'prompts' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: {
      and: [
        { promptKey: { equals: promptKey } },
        { locale: { equals: locale } },
        ...(selfId ? [{ id: { not_equals: selfId } }] : []),
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    throw new APIError(
      `A prompt with key '${promptKey}' and locale '${locale}' already exists`,
      400,
    )
  }

  return data
}
