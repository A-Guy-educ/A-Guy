/**
 * @fileType error-boundary
 * @domain cody
 * @pattern next-error-boundary
 * @ai-summary Error boundary for the Cody dashboard — catches runtime errors and lets the user retry
 */
'use client'

import { useEffect } from 'react'
import { Button } from '@/ui/web/components/button'
import { AlertTriangle } from 'lucide-react'

export default function CodyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CodyDashboard] Unhandled error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-6">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-4">
          The Cody dashboard encountered an error. This is usually temporary.
        </p>
        {error.message && (
          <pre className="text-xs text-left bg-muted p-3 rounded-md mb-4 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => reset()} variant="default">
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  )
}
