'use client'

import React from 'react'

import type { Transaction } from '@/payload-types'

interface PaymentSuccessClientProps {
  transaction: Transaction | null
  orderId: string | undefined
}

export default function PaymentSuccessClient({ transaction, orderId }: PaymentSuccessClientProps) {
  const isLoading = !transaction && orderId
  const isComplete = transaction?.status === 'completed'

  return (
    <div className="container py-section-md">
      <div className="max-w-md mx-auto">
        <div className="bg-card rounded-lg shadow-elevation-1 p-card-padding">
          {isLoading && (
            <div className="text-center">
              <div className="mb-4">
                <div className="h-12 w-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="text-heading-lg mb-2">Processing Payment...</h1>
              <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
            </div>
          )}

          {orderId && !transaction && !isLoading && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="h-12 w-12 mx-auto text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-heading-lg mb-2">Transaction Not Found</h1>
              <p className="text-muted-foreground">
                We could not find a transaction with order ID: {orderId}
              </p>
              <p className="text-muted-foreground mt-4">
                Please contact support if you believe this is an error.
              </p>
            </div>
          )}

          {isComplete && transaction && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="h-12 w-12 mx-auto text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-heading-lg mb-2">Payment Successful!</h1>
              <p className="text-muted-foreground mb-4">
                Thank you for your purchase. Your access has been activated.
              </p>

              <div className="bg-muted rounded-md p-4 text-left">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono">{transaction.tranzilaOrderId}</span>
                  <span className="text-muted-foreground">Amount:</span>
                  <span>
                    {transaction.amount} {transaction.currency}
                  </span>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-success capitalize">{transaction.status}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-4 justify-center">
                <a
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  Browse Courses
                </a>
              </div>
            </div>
          )}

          {transaction && transaction.status === 'pending' && (
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="h-12 w-12 mx-auto text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-heading-lg mb-2">Payment Pending</h1>
              <p className="text-muted-foreground">
                Your payment is being processed. This may take a few moments.
              </p>
              <p className="text-muted-foreground mt-2">Order ID: {transaction.tranzilaOrderId}</p>
            </div>
          )}

          {transaction && transaction.status === 'failed' && (
            <div className="text-center">
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
              <p className="text-muted-foreground">
                {transaction.failureReason || 'Your payment could not be processed.'}
              </p>
              <div className="mt-6 flex gap-4 justify-center">
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
          )}
        </div>
      </div>
    </div>
  )
}
