import type { FieldHook } from 'payload'

import { formatSlug } from './formatSlug'

const MAX_SLUG_ATTEMPTS = 100

export const generateSlug: FieldHook = async ({
  value,
  operation,
  originalDoc,
  siblingData,
  req,
}) => {
  if (operation === 'delete') {
    return value
  }

  // Fail-fast: require req.payload for transaction safety
  if (!req?.payload) {
    throw new Error('req.payload is required for transaction safety')
  }

  const payload = req.payload
  const title =
    siblingData.title || (typeof originalDoc?.title === 'string' ? originalDoc.title : null)

  if (!title) {
    return value || undefined
  }

  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    return value || formatSlug(title)
  }

  const baseSlug = value || formatSlug(title)
  let slug = baseSlug
  let counter = 1

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const existing = await payload.find({
      collection: 'exercises',
      where: {
        and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
      },
      limit: 1,
      depth: 0,
      req,
    })

    if (existing.docs.length === 0) {
      return slug
    }

    if (originalDoc?.id && existing.docs[0]?.id === originalDoc.id) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }

  throw new Error(`Unable to generate unique slug after ${MAX_SLUG_ATTEMPTS} attempts`)
}

export const validateSlugUniqueness: FieldHook = async ({
  value,
  operation,
  originalDoc,
  siblingData,
  req,
}) => {
  if (operation === 'delete' || !value) {
    return value
  }

  // Fail-fast: require req.payload for transaction safety
  if (!req?.payload) {
    throw new Error('req.payload is required for transaction safety')
  }

  const payload = req.payload
  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    return value
  }

  const existing = await payload.find({
    collection: 'exercises',
    where: {
      and: [{ lesson: { equals: lessonId } }, { slug: { equals: value } }],
    },
    limit: 2,
    depth: 0,
    req,
  })

  for (const doc of existing.docs) {
    if (doc.id !== originalDoc?.id) {
      throw new Error(`An exercise with this slug already exists in this lesson`)
    }
  }

  return value
}
