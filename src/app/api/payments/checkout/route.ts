/**
 * Checkout API endpoint
 *
 * POST /api/payments/checkout
 * Body: { productId: string, provider?: 'stripe' | 'paypal' }
 * Returns: { success: boolean, checkoutUrl: string, transactionId: string }
 *
 * @fileType api-route
 * @domain payments
 * @pattern checkout-initiation
 * @ai-summary Initiates a checkout session with the payment provider and creates a pending transaction record
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { z } from 'zod'

import config from '@payload-config'
import { cancelPayPalOrder, createPayPalOrder } from '@/lib/payment/paypal'
import { cancelStripeCheckout, createStripeCheckout } from '@/lib/payment/stripe'

// Schema for checkout request body
const checkoutSchema = z.object({
  productId: z.string().min(1, 'productId_required'),
  provider: z.enum(['stripe', 'paypal']).optional(),
  couponCode: z.string().max(50).optional(),
})

export async function POST(request: NextRequest) {
  // 1. Authenticate user
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) {
    return NextResponse.json({ success: false, error: 'authentication_required' }, { status: 401 })
  }

  // 2. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_body' }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'invalid_request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { productId, provider: requestedProvider, couponCode } = parsed.data

  // 3. Fetch product by ID
  const product = await payload
    .findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!product) {
    return NextResponse.json({ success: false, error: 'product_not_found' }, { status: 404 })
  }

  // Check if product is active
  if ('isActive' in product && !product.isActive) {
    return NextResponse.json({ success: false, error: 'product_not_active' }, { status: 404 })
  }

  // 4. Determine provider
  const productProvider = 'provider' in product ? (product as { provider?: string }).provider : null
  const provider = requestedProvider ?? productProvider ?? 'stripe'

  // Validate provider is supported
  if (provider !== 'stripe' && provider !== 'paypal') {
    return NextResponse.json({ success: false, error: 'invalid_provider' }, { status: 400 })
  }

  // 5. Validate provider matches product (if product has a specific provider)
  if (productProvider && productProvider !== provider) {
    return NextResponse.json(
      {
        success: false,
        error: 'provider_mismatch',
        message: `Product only supports ${productProvider} payments`,
      },
      { status: 400 },
    )
  }

  // 6. Extract product details
  const productName =
    'name' in product ? ((product as { name?: string }).name ?? 'Product') : 'Product'
  const productPrice = 'price' in product ? ((product as { price?: number }).price ?? 0) : 0
  const productCurrency =
    'currency' in product ? ((product as { currency?: string }).currency ?? 'ILS') : 'ILS'
  const productItems = 'items' in product ? ((product as { items?: unknown[] }).items ?? []) : []

  // 7. Convert price to agorot (cents) - multiply by 100
  const amountInAgorot = Math.round(productPrice * 100)

  // 8. Fetch ProductItems to resolve lesson IDs and feature keys
  let itemIds: string[] = []
  let featureKeys: string[] = []

  if (productItems.length > 0) {
    const itemIdsFromItems = productItems
      .map((item) => {
        if (typeof item === 'string') return item
        if (typeof item === 'object' && item !== null && 'id' in item) {
          return (item as { id: string }).id
        }
        return null
      })
      .filter((id): id is string => id !== null)

    if (itemIdsFromItems.length > 0) {
      const items = await payload.find({
        collection: 'product-items',
        where: { id: { in: itemIdsFromItems } },
        depth: 1,
        limit: 100,
        overrideAccess: true,
      })

      for (const item of items.docs) {
        if ('lesson' in item && item.lesson) {
          const lessonId =
            typeof item.lesson === 'string' ? item.lesson : (item.lesson as { id: string }).id
          itemIds.push(lessonId)
        }
        if ('featureKey' in item && item.featureKey) {
          featureKeys.push(item.featureKey as string)
        }
      }
    }
  }

  // 8a. Validate coupon if provided
  let discountedAmount: number | null = null
  let validatedCoupon: {
    id: string
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
  } | null = null

  if (couponCode) {
    const normalizedCode = couponCode.trim().toUpperCase()
    const now = new Date()

    // Query coupon by uppercase code (case-insensitive)
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
      return NextResponse.json({ success: false, error: 'invalid_coupon' }, { status: 400 })
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
    }

    // Check validFrom
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return NextResponse.json({ success: false, error: 'invalid_coupon' }, { status: 400 })
    }

    // Check validUntil
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return NextResponse.json({ success: false, error: 'invalid_coupon' }, { status: 400 })
    }

    // Check maxUses (0 = unlimited)
    if ((coupon.maxUses ?? 0) > 0 && (coupon.usesCount ?? 0) >= (coupon.maxUses ?? 0)) {
      return NextResponse.json({ success: false, error: 'invalid_coupon' }, { status: 400 })
    }

    // Check applicableProducts
    const applicableProducts = coupon.applicableProducts ?? []
    const productIds = applicableProducts.map((p) => (typeof p === 'string' ? p : p.id))
    if (productIds.length > 0 && !productIds.includes(productId)) {
      return NextResponse.json({ success: false, error: 'invalid_coupon' }, { status: 400 })
    }

    // Calculate discounted amount
    const originalAmount = amountInAgorot
    if (coupon.discountType === 'percentage') {
      discountedAmount = Math.round(originalAmount * (1 - coupon.discountValue / 100))
    } else {
      // fixed: subtract discountValue (already in agorot)
      discountedAmount = Math.max(0, originalAmount - coupon.discountValue)
    }
    // Enforce minimum of 1 agorot
    discountedAmount = Math.max(1, discountedAmount)

    payload.logger.info(
      {
        couponCode: normalizedCode,
        originalAmount,
        discountedAmount,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      'Coupon applied: discount calculated',
    )

    validatedCoupon = {
      id: coupon.id,
      code: normalizedCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    }
  }

  // 9. Build URLs for payment provider redirect
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${baseUrl}/checkout/cancel?product_id=${productId}`

  // 10. Call payment provider to create checkout session
  let providerResult: { checkoutUrl: string; providerSessionId: string } | null = null

  try {
    if (provider === 'stripe') {
      providerResult = await createStripeCheckout({
        productId,
        productName,
        amount: discountedAmount ?? amountInAgorot,
        currency: productCurrency as 'ILS' | 'USD' | 'EUR',
        userId: user.id,
        successUrl,
        cancelUrl,
      })
    } else {
      providerResult = await createPayPalOrder({
        productId,
        productName,
        amount: discountedAmount ?? amountInAgorot,
        currency: productCurrency as 'ILS' | 'USD' | 'EUR',
        userId: user.id,
        successUrl,
        cancelUrl,
      })
    }
  } catch (error) {
    payload.logger.error(
      { error, productId, userId: user.id, provider },
      'Payment provider checkout creation failed',
    )

    const errorMessage = error instanceof Error ? error.message : 'unknown_error'

    if (
      errorMessage === 'Missing STRIPE_SECRET_KEY environment variable' ||
      errorMessage === 'Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable'
    ) {
      return NextResponse.json(
        { success: false, error: 'payment_provider_not_configured' },
        { status: 503 },
      )
    }

    return NextResponse.json({ success: false, error: 'checkout_creation_failed' }, { status: 500 })
  }

  // 11. Create Transaction record with status 'pending'
  let transactionId: string
  const finalAmount = discountedAmount ?? amountInAgorot
  try {
    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        user: user.id,
        product: productId,
        provider,
        providerTransactionId: providerResult.providerSessionId,
        status: 'pending',
        amount: finalAmount,
        currency: productCurrency.toUpperCase(),
        metadata: {
          itemIds,
          featureKeys,
          ...(validatedCoupon &&
            discountedAmount !== null && {
              appliedCoupon: {
                code: validatedCoupon.code,
                discountType: validatedCoupon.discountType,
                discountValue: validatedCoupon.discountValue,
                originalAmount: amountInAgorot,
                discountedAmount,
              },
            }),
        },
        successUrl,
        cancelUrl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tenantField has beforeValidate hook that auto-populates tenant
      } as any,
      draft: false,
      overrideAccess: true,
    })
    transactionId = transaction.id
  } catch (error) {
    payload.logger.error(
      {
        error,
        productId,
        userId: user.id,
        provider,
        providerTransactionId: providerResult.providerSessionId,
      },
      'Failed to create transaction record',
    )

    // Attempt to cancel the provider checkout session to prevent orphaned sessions
    try {
      if (provider === 'stripe') {
        await cancelStripeCheckout(providerResult.providerSessionId)
      } else {
        await cancelPayPalOrder(providerResult.providerSessionId)
      }
      payload.logger.info(
        { providerTransactionId: providerResult.providerSessionId, provider },
        'Cancelled orphaned provider checkout session',
      )
    } catch (cancelError) {
      payload.logger.error(
        { cancelError, providerTransactionId: providerResult.providerSessionId, provider },
        'Failed to cancel orphaned provider checkout session — manual intervention may be required',
      )
    }

    return NextResponse.json(
      { success: false, error: 'transaction_record_failed' },
      { status: 500 },
    )
  }

  // 12a. Record coupon usage if applied
  if (validatedCoupon) {
    try {
      await payload.create({
        collection: 'coupon-usages',
        data: {
          coupon: validatedCoupon.id,
          transaction: transactionId,
          user: user.id,
          tenant: (product as any).tenant ?? null,
        } as any,
        overrideAccess: true,
        // checkout does its own usesCount update below; opt the collection's
        // afterChange hook out to avoid double-incrementing.
        context: { skipUsesCountHook: true },
      })

      // Increment usesCount on the coupon
      const currentCoupon = await payload.findByID({
        collection: 'coupons',
        id: validatedCoupon.id,
        depth: 0,
        overrideAccess: true,
      })
      await payload.update({
        collection: 'coupons',
        id: validatedCoupon.id,
        data: {
          usesCount: (currentCoupon?.usesCount ?? 0) + 1,
        } as any,
        overrideAccess: true,
      })
    } catch (usageError) {
      // Non-fatal: log but don't fail the checkout
      payload.logger.error(
        { usageError, couponId: validatedCoupon.id, transactionId, userId: user.id },
        'Failed to record coupon usage — checkout still valid',
      )
    }
  }

  // 12. Return checkout URL and transaction ID
  return NextResponse.json({
    success: true,
    checkoutUrl: providerResult.checkoutUrl,
    transactionId,
    ...(validatedCoupon &&
      discountedAmount !== null && {
        appliedCoupon: {
          code: validatedCoupon.code,
          discountType: validatedCoupon.discountType,
          discountValue: validatedCoupon.discountValue,
          discountedAmount,
        },
      }),
  })
}
