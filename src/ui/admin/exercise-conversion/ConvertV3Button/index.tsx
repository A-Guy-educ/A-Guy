'use client'

import { useState } from 'react'

interface SubQuestionDraft {
  prompt: string
  type: 'free_response' | 'mcq' | 'true_false'
  options: string[]
  correctAnswer: number | null
  acceptedAnswer?: string
}

interface PreviewData {
  title: string
  draft: {
    title: string
    stem?: string
    subQuestions: SubQuestionDraft[]
    diagramDescription?: string
    diagramPosition?: string
  }
  content: {
    blocks: unknown[]
  }
  metadata: {
    model: string
    processingTimeMs: number
    promptId?: string
    promptVersion?: string
  }
  extractionLogId: string
}

interface ConvertV3ButtonProps {
  lessonId: string
  mediaId: string
  onPreview: (data: PreviewData) => void
}

/**
 * V3 Convert Button Component
 *
 * Triggers the V3 single-exercise extraction pipeline.
 */
export function ConvertV3Button({ lessonId, mediaId, onPreview }: ConvertV3ButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConvert = async () => {
    setIsLoading(true)
    setError(null)

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
        throw new Error(data.error?.message || data.error || 'Failed to extract exercise')
      }

      // Pass preview data to parent
      onPreview(data.data)
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
        {isLoading ? 'Extracting...' : 'Convert V3'}
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

export default ConvertV3Button
