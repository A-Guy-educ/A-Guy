/**
 * Purchase Receipt Email Service
 *
 * Sends a templated purchase receipt email to the user after successful payment.
 * Implements a no-op fallback when no email adapter is configured so dev/test
 * environments do not fail — the payment and entitlement grant must never roll
 * back due to email failure.
 *
 * Idempotency: if emailSentAt is already set on the transaction, skips sending.
 *
 * @fileType service
 * @domain email
 * @pattern purchase-receipt
 * @ai-summary Sends purchase receipt emails after successful payment webhooks
 */

import type { Payload } from 'payload'

import {
  buildPurchaseReceiptEmailEN,
  buildPurchaseReceiptEmailHE,
  type PurchaseReceiptData,
} from '../templates/purchase-receipt'

const PURCHASES_URL = '/account/purchases'

export interface SendPurchaseReceiptOptions {
  transactionId: string
  userId: string
  productId: string
  providerTransactionId: string
  amount: number
  currency: string
  userLocale?: string
  appliedCoupon?: {
    code: string
    discountType: string
    discountValue: number
    originalAmount?: number
    discountedAmount?: number
  } | null
}

/**
 * Renders an email template to an HTML string.
 */
function renderEmailTemplate(locale: string, data: PurchaseReceiptData): string {
  if (locale === 'he') {
    return buildPurchaseReceiptEmailHE(data)
  }
  return buildPurchaseReceiptEmailEN(data)
}

/**
 * Formats a coupon discount value for display in the email.
 */
function formatCouponDiscount(discountType: string, discountValue: number): string {
  if (discountType === 'percentage') {
    return `${discountValue}%`
  }
  if (discountType === 'fixed') {
    return `$${(discountValue / 100).toFixed(2)}`
  }
  return `${discountValue}`
}

/**
 * Sends a purchase receipt email for a successful transaction.
 *
 * @param payload - Payload CMS instance (provides logger and Local API)
 * @param options - Transaction and user details needed to render the receipt
 * @returns true if email was (or already was) sent; false on error (caller must NOT throw)
 */
export async function sendPurchaseReceipt(
  payload: Payload,
  options: SendPurchaseReceiptOptions,
): Promise<boolean> {
  const {
    transactionId,
    userId,
    productId,
    providerTransactionId,
    amount,
    currency,
    userLocale = 'he',
    appliedCoupon,
  } = options

  // ── 1. Idempotency: skip if email already sent ─────────────────────────────
  const existing = await payload.findByID({
    collection: 'transactions',
    id: transactionId,
    depth: 0,
    overrideAccess: true,
  })

  if ((existing as { emailSentAt?: string | null }).emailSentAt) {
    payload.logger.info({ transactionId }, 'Purchase receipt email already sent — skipping')
    return true
  }

  // ── 2. Fetch user and product data ─────────────────────────────────────────
  let userEmail: string
  let productName: string

  try {
    const [userResult, productResult] = await Promise.all([
      payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true }),
      payload.findByID({ collection: 'products', id: productId, depth: 0, overrideAccess: true }),
    ])

    userEmail = (userResult as { email: string }).email
    productName = (productResult as { name: string }).name
  } catch (err) {
    // If we can't fetch user/product data, log and return false without throwing
    payload.logger.error(
      { error: err, transactionId, userId, productId },
      'Purchase receipt email: failed to fetch user or product data',
    )
    return false
  }

  // ── 3. Build template data ─────────────────────────────────────────────────
  const paymentDate = new Date().toLocaleDateString(userLocale === 'he' ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const templateData: PurchaseReceiptData = {
    productName,
    amount,
    currency,
    transactionId: providerTransactionId,
    paymentDate,
    purchaseLink: PURCHASES_URL,
    ...(appliedCoupon
      ? {
          couponCode: appliedCoupon.code,
          couponDiscount: formatCouponDiscount(
            appliedCoupon.discountType,
            appliedCoupon.discountValue,
          ),
          originalAmount: appliedCoupon.originalAmount,
        }
      : {}),
  }

  const html = renderEmailTemplate(userLocale, templateData)

  // ── 4. Send email (no-op fallback if adapter not configured) ──────────────
  // payload.email is only populated when an email adapter (e.g. Resend, SendGrid)
  // is configured in payload.config.ts. In dev/test environments without an
  // adapter, we log a warning and return false — this must NOT throw so the
  // webhook can still return 200.
  if (!payload.email) {
    payload.logger.warn(
      { transactionId, userEmail, productName },
      'Purchase receipt email: no email adapter configured — skipping send (no-op fallback). Configure an email adapter in payload.config.ts to enable sending.',
    )
    return false
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.email as any).send({
      to: userEmail,
      subject:
        userLocale === 'he'
          ? `אישור רכישה — ${productName}`
          : `Purchase Confirmed — ${productName}`,
      html,
    })

    // Record successful send on the transaction
    await payload.update({
      collection: 'transactions',
      id: transactionId,
      data: { emailSentAt: new Date().toISOString() },
      overrideAccess: true,
    })

    payload.logger.info(
      { transactionId, userEmail, productName },
      'Purchase receipt email sent successfully',
    )
    return true
  } catch (err) {
    // Log the error with full context but do NOT throw — email failure must not
    // fail the webhook (200 still returned, payment + entitlements already granted).
    payload.logger.error(
      { error: err, transactionId, userEmail, productName },
      'Purchase receipt email send failed — email error logged, webhook will not fail',
    )
    return false
  }
}
