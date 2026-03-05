'use client'

import { useState } from 'react'

interface ConvertV3ButtonProps {
  lessonId: string
  mediaId: string
}

interface ConvertResult {
  exerciseId: string
  adminUrl: string
}

/**
 * V3 Convert Button Component
 *
 * Triggers the V3 single-exercise extraction and creation pipeline.
 * Shows success message with link to the created exercise.
 */
export function ConvertV3Button({ lessonId, mediaId }: ConvertV3ButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ConvertResult | null>(null)

  const handleConvert = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/exercises/convert/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lessonId, mediaId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to convert exercise')
      }

      // Set result to show success message
      setResult(data.data)
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
        disabled={isLoading || !!result}
        style={{
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 500,
          border: 'none',
          borderRadius: 3,
          backgroundColor: result
            ? 'var(--theme-success)'
            : isLoading
              ? 'var(--theme-elevation-400)'
              : 'var(--theme-primary)',
          color:
            result || isLoading ? 'var(--theme-elevation-0)' : 'var(--theme-primary-foreground)',
          cursor: isLoading || result ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Converting...' : result ? 'Created' : 'Convert V3'}
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
      {result && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--theme-success)',
          }}
        >
          Exercise created successfully!{' '}
          <a
            href={result.adminUrl}
            style={{
              color: 'var(--theme-primary)',
              textDecoration: 'underline',
            }}
          >
            View exercise
          </a>
        </span>
      )}
    </div>
  )
}

export default ConvertV3Button
