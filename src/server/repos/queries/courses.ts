import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

export const queryCourseBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'courses',
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          status: {
            equals: 'published',
          },
        },
        {
          isActive: {
            equals: true,
          },
        },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs?.[0] || null
})

export const queryPublishedCourses = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'courses',
    where: {
      and: [
        {
          status: {
            equals: 'published',
          },
        },
        {
          isActive: {
            equals: true,
          },
        },
      ],
    },
    sort: 'order',
    limit: 1000,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs
})
