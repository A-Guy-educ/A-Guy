/**
 * Payment Cancel Page
 *
 * @fileType page
 * @domain payments
 * @ai-summary Cancel page when user cancels at Tranzila
 */

import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ orderId?: string }>
}

export default async function PaymentCancelPage({ searchParams }: PageProps) {
  const params = await searchParams
  const orderId = params.orderId

  return (
    <div className="container py-section-md">
      <div className="max-w-md mx-auto">
        <div className="bg-card rounded-lg shadow-elevation-1 p-card-padding text-center">
          <div className="mb-4">
            <svg
              className="h-12 w-12 mx-auto text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-heading-lg mb-2">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-4">
            Your payment was cancelled and you have not been charged.
          </p>
          {orderId && (
            <p className="text-body-sm text-muted-foreground mb-4">Order ID: {orderId}</p>
          )}
          <div className="flex gap-content-gap justify-center">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-body-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              Return to Shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
