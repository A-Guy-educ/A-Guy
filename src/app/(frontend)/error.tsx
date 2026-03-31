'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  // Detect browser language
  const isHebrew = typeof navigator !== 'undefined' && navigator.language?.startsWith('he')

  const content = {
    heading: isHebrew ? 'משהו השתבש!' : 'Something went wrong!',
    tryAgain: isHebrew ? 'נסה שוב' : 'Try again',
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center justify-center min-h-screen p-5 text-center bg-background text-foreground animate-in fade-in"
    >
      <h2 className="text-display-sm font-bold">{content.heading}</h2>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-lg bg-primary px-6 py-2.5 text-body-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-normal"
      >
        {content.tryAgain}
      </button>
    </div>
  )
}
