/**
 * Grant entitlements for a purchased product.
 *
 * Called by webhook handlers after payment success.
 * Idempotent: re-runs on duplicate webhook delivery are safe due to $ne guards.
 *
 * @fileType utility
 * @domain payments
 * @pattern atomic-update
 * @ai-summary Grants course and feature entitlements after successful payment using atomic MongoDB operations
 */

import { ObjectId } from 'mongodb'
import { getPayload } from 'payload'

import config from '@payload-config'
import type { FeatureKey } from '@/lib/products/feature-keys'

/**
 * Grant entitlements for a purchased product.
 *
 * @param userId - The user receiving entitlements
 * @param productId - The product that was purchased
 * @param transactionId - The transaction ID for tracing
 *
 * Flow:
 * 1. Fetches the Product with its items populated
 * 2. For each ProductItem where type === 'lesson': atomic $push to courseEntitlements with $ne guard
 * 3. For each ProductItem where type === 'feature': atomic $push to featureEntitlements with $ne guard
 */
export async function grantProductEntitlements(
  userId: string,
  productId: string,
  transactionId: string,
): Promise<void> {
  const payload = await getPayload({ config })

  // 1. Fetch the product with items populated
  const product = await payload.findByID({
    collection: 'products',
    id: productId,
    depth: 1,
    overrideAccess: true,
  })

  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }

  // 2. Extract item IDs and resolve lesson relationships
  const itemIds: string[] = []
  const lessonGrants: Array<{
    _id: ObjectId
    course: ObjectId
    grantMethod: 'payment'
    grantedAt: string
    transactionId: string
  }> = []
  const featureKeys: Array<{ key: string }> = []

  if (product.items && Array.isArray(product.items)) {
    for (const item of product.items) {
      const itemId = typeof item === 'string' ? item : item.id
      if (itemId) {
        itemIds.push(itemId)
      }
    }
  }

  // 3. Fetch all product items to determine their type
  if (itemIds.length > 0) {
    const items = await payload.find({
      collection: 'product-items',
      where: {
        id: { in: itemIds },
      },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    })

    for (const item of items.docs) {
      if (item.type === 'lesson' && item.lesson) {
        const lessonId = typeof item.lesson === 'string' ? item.lesson : item.lesson.id
        lessonGrants.push({
          _id: new ObjectId(),
          course: new ObjectId(lessonId),
          grantMethod: 'payment',
          grantedAt: new Date().toISOString(),
          transactionId,
        })
      } else if (item.type === 'feature' && item.featureKey) {
        featureKeys.push({ key: item.featureKey as FeatureKey })
      }
    }
  }

  // 4. Get users collection for direct MongoDB access
  const usersCollection = payload.db.collections['users']
  const userObjectId = new ObjectId(userId)

  // 5. Atomic $push for each lesson entitlement
  for (const lesson of lessonGrants) {
    await usersCollection.updateOne(
      {
        _id: userObjectId,
        'courseEntitlements.course': { $ne: lesson.course },
      },
      {
        $push: { courseEntitlements: lesson },
      },
    )
  }

  // 6. Atomic $push for each feature entitlement
  for (const feature of featureKeys) {
    await usersCollection.updateOne(
      {
        _id: userObjectId,
        'featureEntitlements.key': { $ne: feature.key },
      },
      {
        $push: {
          featureEntitlements: {
            _id: new ObjectId(),
            key: feature.key,
            transactionId,
            grantedAt: new Date().toISOString(),
          },
        },
      },
    )
  }
}
