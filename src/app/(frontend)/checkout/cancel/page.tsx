/**
 * Checkout Cancel Page
 *
 * Displays a friendly message when the user cancels payment.
 * Shows the product they were purchasing with a re-purchase CTA.
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
import { CheckoutCancelContent } from './CheckoutCancelContent'

type Props = {
  searchParams: Promise<{ product_id?: string }>
}

export async function generateMetadata({
  searchParams: _searchParamsPromise,
}: Props): Promise<Metadata> {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'התשלום בוטל' : 'Payment Cancelled',
    description: isHebrew
      ? 'התשלום בוטל. תוכל לנסות שוב בכל עת.'
      : 'Your payment was cancelled. You can try again anytime.',
  })
}

export default async function CheckoutCancelPage({ searchParams: searchParamsPromise }: Props) {
  const { product_id } = await searchParamsPromise
  const locale = await getSystemLocale()

  let product = null

  if (product_id) {
    try {
      const payload = await getPayload({ config })
      product = await payload
        .findByID({
          collection: 'products',
          id: product_id,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
    } catch {
      product = null
    }
  }

  return (
    <div
      className="min-h-screen text-card-foreground antialiased flex items-center justify-center"
      dir={getDirection(locale)}
    >
      <CheckoutCancelContent
        productId={product_id}
        product={product as { id: string; name?: string; slug?: string } | null}
      />
    </div>
  )
}
