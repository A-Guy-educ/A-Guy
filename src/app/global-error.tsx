'use client'

import * as Sentry from '@sentry/nextjs'
import Error from 'next/error'
import { useEffect } from 'react'

export default function GlobalError({
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

  const htmlLang = isHebrew ? 'he' : 'en'
  const htmlDir = isHebrew ? 'rtl' : 'ltr'

  return (
    <html lang={htmlLang} dir={htmlDir}>
      <body>
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-col items-center justify-center min-h-screen p-5 text-center"
        >
          <h2>{content.heading}</h2>
          <button
            onClick={() => reset()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {content.tryAgain}
          </button>
        </div>
      </body>
    </html>
  )
}
