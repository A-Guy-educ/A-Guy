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
import { createPayPalOrder } from '@/lib/payment/paypal'
import { createStripeCheckout } from '@/lib/payment/stripe'

// Schema for checkout request body
const checkoutSchema = z.object({
  productId: z.string().min(1, 'productId_required'),
  provider: z.enum(['stripe', 'paypal']).optional(),
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

  const { productId, provider: requestedProvider } = parsed.data

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
        amount: amountInAgorot,
        currency: productCurrency as 'ILS' | 'USD' | 'EUR',
        userId: user.id,
        successUrl,
        cancelUrl,
        provider: 'stripe',
      })
    } else {
      providerResult = await createPayPalOrder({
        productId,
        productName,
        amount: amountInAgorot,
        currency: productCurrency as 'ILS' | 'USD' | 'EUR',
        userId: user.id,
        successUrl,
        cancelUrl,
        provider: 'paypal',
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
  try {
    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        user: user.id,
        product: productId,
        provider,
        providerTransactionId: providerResult.providerSessionId,
        status: 'pending',
        amount: amountInAgorot,
        currency: productCurrency.toUpperCase(),
        metadata: {
          itemIds,
          featureKeys,
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
    // Transaction wasn't saved - but payment session was created
    // Log error but return success since user is mid-checkout
    return NextResponse.json(
      { success: false, error: 'transaction_record_failed' },
      { status: 500 },
    )
  }

  // 12. Return checkout URL and transaction ID
  return NextResponse.json({
    success: true,
    checkoutUrl: providerResult.checkoutUrl,
    transactionId,
  })
}
