/**
 * Uniqueness hooks for (field, locale) pairs
 *
 * MongoDB compound uniqueness enforced via beforeChange hooks.
 */
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

/**
 * Factory: enforces unique (fieldName, locale) per collection.
 * Works for slug+locale, promptKey+locale, or any other field.
 */
export function enforceFieldLocaleUniqueness(
  collectionSlug: string,
  fieldName: string = 'slug',
): CollectionBeforeChangeHook {
  return async ({ data, req, operation, originalDoc }) => {
    const fieldValue = data?.[fieldName] ?? originalDoc?.[fieldName]
    const locale = data?.locale ?? originalDoc?.locale
    if (!fieldValue || !locale) return data

    const selfId = operation === 'update' ? originalDoc?.id : undefined

    const existing = await req.payload.find({
      collection: collectionSlug as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      where: {
        and: [
          { [fieldName]: { equals: fieldValue } },
          { locale: { equals: locale } },
          ...(selfId ? [{ id: { not_equals: selfId } }] : []),
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      throw new APIError(
        `A document with ${fieldName} '${fieldValue}' and locale '${locale}' already exists in ${collectionSlug}`,
        400,
      )
    }

    return data
  }
}
