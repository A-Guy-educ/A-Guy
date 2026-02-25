import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const queryContentPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'content-pages',
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 1,
  })

  return result.docs?.[0] || null
})

export const queryContentPageById = cache(async ({ id }: { id: string }) => {
  const payload = await getPayload({ config: configPromise })

  try {
    return await payload.findByID({
      collection: 'content-pages',
      id,
      depth: 1,
    })
  } catch {
    return null
  }
})
