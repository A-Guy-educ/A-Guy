/**
 * Product Query Functions
 *
 * @fileType repository
 * @domain billing
 * @pattern repository
 */

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import { cache } from 'react'

import type { Product } from '@/payload-types'

export const queryActiveProducts = cache(async (): Promise<Product[]> => {
  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = [{ isActive: { equals: true } }]

  const result = await payload.find({
    collection: 'products',
    where: { and: conditions },
    sort: 'createdAt',
    limit: 100,
    pagination: false,
    depth: 1,
    overrideAccess: false,
  })

  return result.docs as Product[]
})

export const queryProductBySlug = cache(
  async ({ slug }: { slug: string }): Promise<Product | null> => {
    const payload = await getPayload({ config: configPromise })

    const conditions: Where[] = [{ slug: { equals: slug } }, { isActive: { equals: true } }]

    const result = await payload.find({
      collection: 'products',
      where: { and: conditions },
      limit: 1,
      pagination: false,
      depth: 1,
      overrideAccess: false,
    })

    return (result.docs?.[0] as Product) || null
  },
)

export const queryAllProductSlugs = cache(async (): Promise<{ slug: string }[]> => {
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'products',
    where: { isActive: { equals: true } },
    select: { slug: true },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: false,
  })

  return result.docs.map((doc) => ({ slug: (doc as { slug: string }).slug }))
})
