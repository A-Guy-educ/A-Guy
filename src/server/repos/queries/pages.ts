import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

export const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    pagination: false,
    depth: 2,
  })

  return result.docs?.[0] || null
})

export const queryPublishedPages = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    where: {
      status: {
        equals: 'published',
      },
    },
    sort: 'publishedAt',
    limit: 1000,
    pagination: false,
    depth: 2,
  })

  return result.docs
})

export const queryAllPageSlugs = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return result.docs?.filter((doc) => doc.slug !== 'home').map(({ slug }) => ({ slug })) || []
})

export const queryAllPagesForSitemap = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    where: {
      status: {
        equals: 'published',
      },
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    limit: 1000,
    pagination: false,
  })

  return result.docs
})
