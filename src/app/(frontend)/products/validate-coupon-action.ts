'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'

const validateCouponSchema = z.object({
  couponCode: z.string().min(1).max(50),
  productId: z.string().min(1),
})

export type ValidateCouponResult =
  | {
      success: true
      discountType: 'percentage' | 'fixed'
      discountValue: number
      discountedAmount: number
      originalAmount: number
    }
  | { success: false; error: string }

/**
 * Validates a coupon code for a product without creating a transaction.
 * Used on the product detail page to give users feedback before they commit to buy.
 */
export async function validateCouponAction(
  productId: string,
  couponCode: string,
): Promise<ValidateCouponResult> {
  const headersList = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return { success: false, error: 'authentication_required' }
  }

  const parsed = validateCouponSchema.safeParse({ productId, couponCode })
  if (!parsed.success) {
    return { success: false, error: 'invalid_request' }
  }

  // Fetch product
  const product = await payload
    .findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!product || !('isActive' in product) || !product.isActive) {
    return { success: false, error: 'product_not_found' }
  }

  const productPrice = 'price' in product ? ((product as { price?: number }).price ?? 0) : 0
  const originalAmount = Math.round(productPrice * 100)

  // Normalize coupon code
  const normalizedCode = couponCode.trim().toUpperCase()
  const now = new Date()

  // Query coupon
  const coupons = await payload.find({
    collection: 'coupons',
    where: {
      code: { equals: normalizedCode },
      isActive: { equals: true },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (coupons.totalDocs === 0) {
    return { success: false, error: 'invalid_coupon' }
  }

  const coupon = coupons.docs[0] as {
    id: string
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    validFrom?: string | null
    validUntil?: string | null
    maxUses?: number
    usesCount?: number
    applicableProducts?: { id: string }[] | string[]
    tenant?: unknown
  }

  // Check validFrom
  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return { success: false, error: 'invalid_coupon' }
  }

  // Check validUntil
  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    return { success: false, error: 'invalid_coupon' }
  }

  // Check maxUses
  if ((coupon.maxUses ?? 0) > 0 && (coupon.usesCount ?? 0) >= (coupon.maxUses ?? 0)) {
    return { success: false, error: 'invalid_coupon' }
  }

  // Check applicableProducts
  const applicableProducts = coupon.applicableProducts ?? []
  const productIds = applicableProducts.map((p) =>
    typeof p === 'string' ? p : (p as { id: string }).id,
  )
  if (productIds.length > 0 && !productIds.includes(productId)) {
    return { success: false, error: 'invalid_coupon' }
  }

  // Calculate discounted amount
  let discountedAmount: number
  if (coupon.discountType === 'percentage') {
    discountedAmount = Math.round(originalAmount * (1 - coupon.discountValue / 100))
  } else {
    discountedAmount = Math.max(0, originalAmount - coupon.discountValue)
  }
  discountedAmount = Math.max(1, discountedAmount)

  return {
    success: true,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountedAmount,
    originalAmount,
  }
}
