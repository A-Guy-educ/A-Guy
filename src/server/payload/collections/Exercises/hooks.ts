import type { FieldHook } from 'payload'

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { formatSlug } from '@/utilities/formatSlug'

export const generateSlug: FieldHook = async ({ value, operation, originalDoc, siblingData }) => {
  if (operation === 'delete') {
    return value
  }

  const title =
    siblingData.title || (typeof originalDoc?.title === 'string' ? originalDoc.title : null)

  if (!title) {
    return value || undefined
  }

  const payload = await getPayload({ config: configPromise })
  const lessonId =
    siblingData.lesson || (typeof originalDoc?.lesson === 'string' ? originalDoc.lesson : null)

  if (!lessonId) {
    return value || formatSlug(title)
  }

  const baseSlug = value || formatSlug(title)
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await payload.find({
      collection: 'exercises',
      where: {
        and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
      },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      break
    }

    if (originalDoc?.id && existing.docs[0]?.id === originalDoc.id) {
      break
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }

  return slug
}

export const validateSlugUniqueness: FieldHook = async ({
  value,
  operation,
  originalDoc,
  siblingData,
}) => {
  if (operation === 'delete' || !value) {
    return value
  }

  const payload = await getPayload({ config: configPromise })
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
  })

  for (const doc of existing.docs) {
    if (doc.id !== originalDoc?.id) {
      throw new Error(`An exercise with this slug already exists in this lesson`)
    }
  }

  return value
}
