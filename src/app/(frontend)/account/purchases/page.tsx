/**
 * Purchases Page
 *
 * /account/purchases - Lists all user transactions sorted by date desc
 *
 * @fileType page
 * @domain billing
 */

import { notFound } from 'next/navigation'

import { getDirection } from '@/i18n/config'
import { getSystemLocale } from '@/i18n/server-locale'
import { pageMetadata } from '@/infra/seo/pageMetadata'
import { getMeUser } from '@/infra/utils/getMeUser'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Metadata } from 'next'
import { PurchasesPageContent } from './PurchasesPageContent'
import type { TransactionWithProduct } from './PurchasesPageContent'

type Props = {
  searchParams: Promise<{ next?: string }>
}

export async function generateMetadata(_props: Props): Promise<Metadata> {
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'הרכישות שלי' : 'My Purchases',
    description: isHebrew ? 'צפה בהיסטוריית הרכישות שלך' : 'View your purchase history',
  })
}

export default async function PurchasesPage({ searchParams: searchParamsPromise }: Props) {
  const { next } = await searchParamsPromise

  // Auth gate - redirect to login with returnTo if not authenticated
  const { user } = await getMeUser({
    nullUserRedirect: next
      ? `/login?returnTo=${encodeURIComponent(next)}`
      : '/login?returnTo=/account/purchases',
  })

  if (!user) {
    notFound()
  }

  const locale = await getSystemLocale()

  // Fetch user's transactions using Payload local API
  const payload = await getPayload({ config })

  const transactionsResult = await payload.find({
    collection: 'transactions',
    where: {
      user: { equals: user.id },
    },
    sort: '-createdAt',
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })

  // Extract product names from transactions
  const transactions: TransactionWithProduct[] = transactionsResult.docs.map((tx) => {
    const productName =
      typeof tx.product === 'object' && tx.product !== null
        ? ((tx.product as { name?: string }).name ?? null)
        : null

    const productSlug =
      typeof tx.product === 'object' && tx.product !== null
        ? ((tx.product as { slug?: string }).slug ?? null)
        : null

    const couponCode =
      tx.metadata && typeof tx.metadata === 'object' && !Array.isArray(tx.metadata)
        ? ((tx.metadata as { couponCode?: string }).couponCode ?? null)
        : null

    return {
      id: tx.id,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      createdAt: tx.createdAt,
      provider: tx.provider,
      productName,
      productSlug,
      couponCode,
      refundedAmount: tx.refundedAmount ?? null,
      refundedAt: (tx as { refundedAt?: string }).refundedAt ?? null,
    }
  })

  return (
    <div dir={getDirection(locale)}>
      <PurchasesPageContent transactions={transactions} />
    </div>
  )
}
