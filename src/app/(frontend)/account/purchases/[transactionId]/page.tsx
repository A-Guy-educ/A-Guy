/**
 * Transaction Detail Page
 *
 * /account/purchases/[transactionId] - Shows full transaction details + unlocked entitlements
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
import { TransactionDetailContent } from './TransactionDetailContent'
import type { TransactionDetailData, EntitlementInfo } from './TransactionDetailContent'

type Props = {
  params: Promise<{ transactionId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { transactionId: _transactionId } = await params
  const locale = await getSystemLocale()
  const isHebrew = locale === 'he'

  return pageMetadata({
    title: isHebrew ? 'פרטי רכישה' : 'Purchase Details',
    description: isHebrew ? 'פרטי הרכישה שלך' : 'Your purchase details',
  })
}

export default async function TransactionDetailPage({ params: paramsPromise }: Props) {
  const { transactionId } = await paramsPromise

  // Auth gate - redirect to login with returnTo if not authenticated
  const { user } = await getMeUser({
    nullUserRedirect: `/login?returnTo=${encodeURIComponent(`/account/purchases/${transactionId}`)}`,
  })

  if (!user) {
    notFound()
  }

  const locale = await getSystemLocale()

  // Fetch the transaction
  const payload = await getPayload({ config })

  let transaction: TransactionDetailData | null = null
  let productName: string | null = null
  let productSlug: string | null = null
  let entitlements: EntitlementInfo = { lessons: [], features: [] }
  let fetchError = false

  try {
    const tx = await payload.findByID({
      collection: 'transactions',
      id: transactionId,
      depth: 0,
      overrideAccess: true,
    })

    // Server-side authorization: ensure the transaction belongs to the current user
    const transactionUserId = typeof tx.user === 'string' ? tx.user : tx.user?.id
    if (transactionUserId !== user.id) {
      notFound()
    }

    // Extract product info if populated
    if (typeof tx.product === 'object' && tx.product !== null) {
      productName = (tx.product as { name?: string }).name ?? null
      productSlug = (tx.product as { slug?: string }).slug ?? null
    }

    // Extract coupon code from metadata
    const couponCode =
      tx.metadata && typeof tx.metadata === 'object' && !Array.isArray(tx.metadata)
        ? ((tx.metadata as { couponCode?: string }).couponCode ?? null)
        : null

    transaction = {
      id: tx.id,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      provider: tx.provider,
      productName,
      productSlug,
      couponCode,
      refundedAmount: tx.refundedAmount ?? null,
      refundedAt: (tx as { refundedAt?: string }).refundedAt ?? null,
      entitlementsGrantedAt: tx.entitlementsGrantedAt ?? null,
    }

    // If transaction succeeded, fetch entitlements granted by this transaction
    if (tx.status === 'succeeded') {
      // Fetch the user to get their entitlements
      const userDoc = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 0,
        overrideAccess: true,
        select: { courseEntitlements: true, featureEntitlements: true },
      })

      const courseEnts =
        (
          userDoc as {
            courseEntitlements?: Array<{
              course: string
              grantMethod: string
              grantedAt: string | null
              transactionId: string | null
            }>
          }
        ).courseEntitlements ?? []

      const featureEnts =
        (
          userDoc as {
            featureEntitlements?: Array<{
              key: string
              grantedAt: string | null
              transactionId: string | null
            }>
          }
        ).featureEntitlements ?? []

      // Filter entitlements by transactionId
      const lessonEntitlements = courseEnts.filter((e) => e.transactionId === tx.id)
      const featureEntitlements = featureEnts.filter((e) => e.transactionId === tx.id)

      // Fetch lesson/course titles for the entitlements
      if (lessonEntitlements.length > 0) {
        const lessonIds = lessonEntitlements.map((e) => e.course)
        const lessons = await payload.find({
          collection: 'courses',
          where: { id: { in: lessonIds } },
          depth: 0,
          limit: 100,
          overrideAccess: true,
        })
        entitlements.lessons = lessons.docs.map((c) => ({
          id: c.id,
          title: (c as { title?: string }).title ?? 'Untitled',
        }))
      }

      entitlements.features = featureEntitlements.map((e) => ({
        key: e.key,
      }))
    }
  } catch (err) {
    if (err instanceof Error && (err.name === 'NotFound' || err.message.includes('Not Found'))) {
      notFound()
    }
    fetchError = true
  }

  return (
    <div dir={getDirection(locale)}>
      <TransactionDetailContent
        transaction={transaction}
        entitlements={entitlements}
        fetchError={fetchError}
      />
    </div>
  )
}
