import type { FieldHook } from 'payload'

import { formatSlug } from '@/utilities/formatSlug'

async function getPayloadInstance() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('@payload-config')
  return getPayload({ config })
}

export const generateSlug: FieldHook = async ({ value, operation, originalDoc, siblingData }) => {
  // TEMPORARY DEBUG LOGGING
  console.log('[generateSlug] Called with:', {
    operation,
    value,
    originalDocId: originalDoc?.id,
    originalDocSlug: originalDoc?.slug,
    title: siblingData?.title || originalDoc?.title,
  })

  if (operation === 'delete') {
    return value
  }

  const title =
    siblingData.title || (typeof originalDoc?.title === 'string' ? originalDoc.title : null)

  if (!title) {
    console.log('[generateSlug] No title, returning value:', value)
    return value || undefined
  }

  const payload = await getPayloadInstance()
  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    const result = value || formatSlug(title)
    console.log('[generateSlug] No lessonId, returning:', result)
    return result
  }

  const baseSlug = value || formatSlug(title)
  let slug = baseSlug
  let counter = 1

  console.log('[generateSlug] Starting collision check with baseSlug:', baseSlug)

  while (true) {
    const existing = await payload.find({
      collection: 'exercises',
      where: {
        and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
      },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      console.log('[generateSlug] No collision, using slug:', slug)
      break
    }

    if (originalDoc?.id && existing.docs[0]?.id === originalDoc.id) {
      console.log('[generateSlug] Found self, keeping slug:', slug)
      break
    }

    console.log('[generateSlug] Collision detected, trying counter:', counter)
    slug = `${baseSlug}-${counter}`
    counter++
  }

  console.log('[generateSlug] Final slug:', slug)
  return slug
}

export const validateSlugUniqueness: FieldHook = async ({
  value,
  operation,
  originalDoc,
  siblingData,
}) => {
  // TEMPORARY DEBUG LOGGING
  console.log('[validateSlugUniqueness] Called with:', {
    operation,
    value,
    originalDocId: originalDoc?.id,
    originalDocSlug: originalDoc?.slug,
  })

  if (operation === 'delete' || !value) {
    return value
  }

  const payload = await getPayloadInstance()
  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    console.log('[validateSlugUniqueness] No lessonId, skipping validation')
    return value
  }

  const existing = await payload.find({
    collection: 'exercises',
    where: {
      and: [{ lesson: { equals: lessonId } }, { slug: { equals: value } }],
    },
    limit: 2,
  })

  console.log('[validateSlugUniqueness] Found existing docs:', existing.docs.length)

  for (const doc of existing.docs) {
    if (doc.id !== originalDoc?.id) {
      console.error('[validateSlugUniqueness] ERROR: Duplicate slug detected!', {
        slug: value,
        existingDocId: doc.id,
        currentDocId: originalDoc?.id,
      })
      throw new Error(`An exercise with this slug already exists in this lesson`)
    }
  }

  console.log('[validateSlugUniqueness] Validation passed')
  return value
}
