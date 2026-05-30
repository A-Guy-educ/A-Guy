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
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { CheckoutSuccessContent } from './CheckoutSuccessContent'

type Props = {
  searchParams: Promise<{ session_id?: string }>
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
  const { session_id } = await searchParamsPromise
  const locale = await getSystemLocale()

  let transaction = null
  let productName = ''

  if (session_id) {
    try {
      const payload = await getPayload({ config })
      const result = await payload.find({
        collection: 'transactions',
        where: { providerTransactionId: { equals: session_id } },
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
        sessionId={session_id}
        transaction={transaction}
        productName={productName}
      />
    </div>
  )
}
