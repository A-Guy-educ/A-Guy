import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

export const queryPostBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
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

export const queryPublishedPosts = cache(
  async ({ limit = 12, page = 1 }: { limit?: number; page?: number } = {}) => {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'posts',
      where: {
        status: {
          equals: 'published',
        },
      },
      sort: '-createdAt',
      limit,
      page,
      depth: 2,
    })

    return result
  },
)

export const searchPosts = cache(
  async ({ query, limit = 12 }: { query: string; limit?: number }) => {
    const payload = await getPayload({ config: configPromise })

    const result = await payload.find({
      collection: 'posts',
      where: {
        or: [
          {
            title: {
              like: query,
            },
          },
          {
            'meta.description': {
              like: query,
            },
          },
          {
            'meta.title': {
              like: query,
            },
          },
          {
            slug: {
              like: query,
            },
          },
        ],
      },
      limit,
      depth: 1,
      select: {
        title: true,
        slug: true,
        categories: true,
        meta: true,
      },
    })

    return result
  },
)

export const queryAllPostsForSitemap = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
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

export const queryAllPostSlugs = cache(async () => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'posts',
    draft: false,
    limit: 1000,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return result.docs.map(({ slug }) => ({ slug }))
})
