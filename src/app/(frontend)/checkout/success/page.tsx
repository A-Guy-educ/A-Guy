/**
 * Checkout Success Page
 *
 * Displays payment confirmation after Stripe/PayPal redirects back from checkout.
 * Fetches the transaction by session ID (providerTransactionId) and shows:
 * - Confirmed: Payment received, access granted
 * - Pending: Payment received, processing access (webhook timing)
 *
 * @fileType page
 * @domain billing
 */

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { capturePayPalOrder } from '@/lib/payment/paypal'
import { serializePaymentError } from '@/lib/payment/error-log'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { CheckoutSuccessContent } from './CheckoutSuccessContent'

type Props = {
  searchParams: Promise<{ session_id?: string; token?: string; provider?: string }>
}

export async function generateMetadata({
  searchParams: _searchParamsPromise,
}: Props): Promise<Metadata> {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'תשלום הושלם' : 'Payment Confirmed',
    description: isHebrew ? 'התשלום הושלם בהצלחה' : 'Your payment was successfully processed',
  })
}

export default async function CheckoutSuccessPage({ searchParams: searchParamsPromise }: Props) {
  const { session_id, token } = await searchParamsPromise
  // Stripe redirects with ?session_id=cs_..., PayPal with ?token=<order_id>&PayerID=...
  // Both providers store their respective ID in transaction.providerTransactionId,
  // so a single lookup works for either query shape.
  const lookupId = session_id ?? token
  const locale = await getSystemLocale()

  let transaction = null
  let productName = ''
  const payload = lookupId ? await getPayload({ config }) : null

  // PayPal v2 requires an explicit capture call after buyer approval.
  // Without this, intent: 'CAPTURE' orders sit in APPROVED forever and the
  // PAYMENT.CAPTURE.COMPLETED webhook never fires. Capture is idempotent,
  // so a page reload doesn't double-charge.
  if (token && payload) {
    try {
      await capturePayPalOrder(token)
    } catch (error) {
      payload.logger.error(
        { err: serializePaymentError(error), orderId: token },
        'PayPal capture failed on /checkout/success — transaction will stay pending',
      )
    }
  }

  if (lookupId && payload) {
    try {
      const result = await payload.find({
        collection: 'transactions',
        where: { providerTransactionId: { equals: lookupId } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })

      if (result.docs.length > 0) {
        transaction = result.docs[0]
        // Fetch product name
        if (transaction.product) {
          const productId =
            typeof transaction.product === 'string'
              ? transaction.product
              : (transaction.product as { id: string }).id
          try {
            const product = await payload.findByID({
              collection: 'products',
              id: productId,
              depth: 0,
              overrideAccess: true,
            })
            productName = (product as { name?: string }).name ?? ''
          } catch {
            productName = ''
          }
        }
      }
    } catch {
      transaction = null
    }
  }

  return (
    <div
      className="min-h-screen text-card-foreground antialiased flex items-center justify-center"
      dir={getDirection(locale)}
    >
      <CheckoutSuccessContent
        sessionId={lookupId}
        transaction={transaction}
        productName={productName}
      />
    </div>
  )
}
