'use client'

import { useState } from 'react'

interface ConvertV2ButtonProps {
  lessonId: string
  mediaId: string
  onSuccess?: () => void
}

/**
 * V2 Convert Button Component
 *
 * Triggers the V2 image crop conversion pipeline.
 */
export function ConvertV2Button({ lessonId, mediaId, onSuccess }: ConvertV2ButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConvert = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/exercises/convert/queue-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessonId, mediaId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to queue V2 conversion')
      }

      // Trigger success callback to refresh status
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={handleConvert}
        disabled={isLoading}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 500,
          border: 'none',
          borderRadius: 3,
          backgroundColor: 'var(--theme-primary)',
          color: 'var(--theme-primary-foreground)',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Queuing...' : 'Convert (V2 Images)'}
      </button>
      {error && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--theme-error)',
          }}
        >
          {error}
        </span>
      )}
    </div>
  )
}

export default ConvertV2Button
