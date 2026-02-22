import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const queryExercisesByLesson = cache(async ({ lessonId }: { lessonId: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'exercises',
    where: {
      lesson: {
        equals: lessonId,
      },
    },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 1,
  })

  return result.docs
})

export const queryExerciseById = cache(async ({ id }: { id: string }) => {
  const payload = await getPayload({ config: configPromise })

  try {
    const exercise = await payload.findByID({
      collection: 'exercises',
      id,
      depth: 2,
    })

    return exercise
  } catch (error) {
    console.error('Failed to query exercise by ID:', error)
    return null
  }
})

export const queryExerciseBySlug = cache(
  async ({ lessonId, slug }: { lessonId: string; slug: string }) => {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'exercises',
      where: {
        and: [{ lesson: { equals: lessonId } }, { slug: { equals: slug } }],
      },
      limit: 1,
      depth: 2,
    })

    return result.docs[0] || null
  },
)
