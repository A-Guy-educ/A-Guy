/**
 * Payment Initiation API
 *
 * @fileType api-route
 * @domain payments
 * @ai-summary Initiates payment by creating a pending transaction and returning Tranzila URL
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import { getDefaultTenantId } from '@/server/services/tenant/get-default-tenant'
import { buildPaymentUrl, getRedirectUrls } from '@/server/services/payment/tranzila'

import type { PricingPlan } from '@/payload-types'

function generateOrderId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(16).slice(2, 10)
  return `TXN-${timestamp}-${random}`
}

export async function POST(req: Request): Promise<Response> {
  const payload = await getPayload({ config })

  try {
    // Auth check
    const authResult = await payload.auth({ headers: req.headers })
    if (!authResult.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId =
      typeof authResult.user === 'object' && 'id' in authResult.user
        ? (authResult.user as { id: string }).id
        : (authResult.user as string)

    const body = await req.json()
    const { pricingPlanId } = body as { pricingPlanId: string }

    if (!pricingPlanId) {
      return Response.json({ error: 'pricingPlanId is required' }, { status: 400 })
    }

    // Fetch pricing plan
    const plan = (await payload.findByID({
      collection: 'pricing-plans',
      id: pricingPlanId,
      depth: 2,
      overrideAccess: true,
    })) as PricingPlan | null

    if (!plan || !plan.isActive) {
      return Response.json({ error: 'Pricing plan not found or inactive' }, { status: 404 })
    }

    // Check if provider is Tranzila
    if (plan.provider !== 'tranzila') {
      return Response.json({ error: 'Only Tranzila payments are supported' }, { status: 400 })
    }

    // Generate order ID
    const orderId = generateOrderId()

    // Get lesson title for product name
    const lessonTitle =
      typeof plan.lesson === 'object' && plan.lesson !== null
        ? plan.lesson.title
        : 'Course Purchase'
    const productName = lessonTitle || 'Course Purchase'

    // Get default tenant ID
    const tenantId = await getDefaultTenantId(payload)

    // Create pending transaction
    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        tenant: tenantId,
        user: userId,
        pricingPlan: pricingPlanId,
        tranzilaOrderId: orderId,
        amount: plan.price,
        currency: plan.currency,
        status: 'pending',
      },
      draft: false,
      overrideAccess: true,
    })

    // Get redirect URLs
    const { successUrl, cancelUrl, failureUrl } = getRedirectUrls(orderId)

    // Build Tranzila payment URL
    const paymentUrl = buildPaymentUrl({
      pricingPlanId,
      userId,
      orderId,
      amount: plan.price,
      currency: plan.currency,
      productName,
      successUrl,
      cancelUrl,
      failureUrl,
    })

    return Response.json({
      paymentUrl,
      transactionId: transaction.id,
      orderId,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    payload.logger.error({ error: errorMsg }, '[payment-initiate] Handler error')
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
