/**
 * Payment Success Page
 *
 * @fileType page
 * @domain payments
 * @ai-summary Success page after Tranzila payment redirect
 */

import { getPayload } from 'payload'

import config from '@payload-config'
import PaymentSuccessClient from './PaymentSuccessClient'

import type { Transaction } from '@/payload-types'

interface PageProps {
  searchParams: Promise<{ orderId?: string }>
}

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams
  const orderId = params.orderId

  let transaction: Transaction | null = null

  if (orderId) {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'transactions',
      where: { tranzilaOrderId: { equals: orderId } },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (result.totalDocs > 0) {
      transaction = result.docs[0] as Transaction
    }
  }

  return <PaymentSuccessClient transaction={transaction} orderId={orderId} />
}
