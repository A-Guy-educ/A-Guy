/**
 * Payment Failure Page
 *
 * @fileType page
 * @domain payments
 * @ai-summary Failure page when Tranzila payment fails
 */

interface PageProps {
  searchParams: Promise<{ orderId?: string }>
}

export default async function PaymentFailurePage({ searchParams }: PageProps) {
  const params = await searchParams
  const orderId = params.orderId

  return (
    <div className="container py-section-md">
      <div className="max-w-md mx-auto">
        <div className="bg-card rounded-lg shadow-elevation-1 p-card-padding text-center">
          <div className="mb-4">
            <svg
              className="h-12 w-12 mx-auto text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-heading-lg mb-2">Payment Failed</h1>
          <p className="text-muted-foreground mb-4">
            Your payment could not be processed. Please try again or contact support.
          </p>
          {orderId && <p className="text-sm text-muted-foreground mb-4">Order ID: {orderId}</p>}
          <div className="flex gap-4 justify-center">
            <a
              href="/shop"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              Try Again
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium shadow-sm transition-all hover:bg-muted"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
