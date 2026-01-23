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
  } catch (_error) {
    return null
  }
})
