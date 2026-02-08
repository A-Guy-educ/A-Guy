'use client'

import { useEffect, useState } from 'react'

interface ConvertFormProps {
  lessonId: string
  mediaId: string
  filename: string
  onClose: () => void
}

interface PromptOption {
  id: string
  title: string
  key: string
  type: string
  usage: string
}

export function ConvertForm({ lessonId, mediaId, filename, onClose }: ConvertFormProps) {
  const [extractorPrompts, setExtractorPrompts] = useState<PromptOption[]>([])
  const [selectedExtractor, setSelectedExtractor] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadPrompts() {
      try {
        const response = await fetch('/api/prompts/for-conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId }),
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to load prompts')
        }

        const data = await response.json()
        setExtractorPrompts(data.extractors || [])
      } catch {
        setError('Failed to load prompts')
      } finally {
        setIsLoading(false)
      }
    }

    loadPrompts()
  }, [lessonId])

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/exercises/convert/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          mediaId,
          extractorPromptId: selectedExtractor,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Queue failed')
      }

      const data = await response.json()
      setSuccess(`Conversion queued! Job ID: ${data.jobId}`)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (_err) {
      setError('Queue failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        backgroundColor: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: '1px solid var(--theme-elevation-200)',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--theme-elevation-700)',
          }}
        >
          Conversion Options
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--theme-elevation-500)',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filename}
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: 6,
            marginBottom: 8,
            fontSize: 11,
            color: 'var(--theme-error)',
            backgroundColor: 'var(--theme-error-100)',
            borderRadius: 3,
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            padding: 6,
            marginBottom: 8,
            fontSize: 11,
            color: 'var(--theme-success)',
            backgroundColor: 'var(--theme-success-100)',
            borderRadius: 3,
          }}
        >
          {success}
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
          Loading...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={selectedExtractor}
            onChange={(e) => setSelectedExtractor(e.target.value)}
            style={{
              width: '100%',
              height: 28,
              padding: '0 8px',
              fontSize: 12,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 3,
              backgroundColor: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-1000)',
            }}
          >
            <option value="">Select Extractor...</option>
            {extractorPrompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 500,
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: 3,
                backgroundColor: 'var(--theme-elevation-100)',
                color: 'var(--theme-elevation-700)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedExtractor}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 500,
                border: 'none',
                borderRadius: 3,
                backgroundColor: 'var(--theme-elevation-900)',
                color: 'var(--theme-elevation-0)',
                cursor: isSubmitting || !selectedExtractor ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !selectedExtractor ? 0.5 : 1,
              }}
            >
              {isSubmitting ? '...' : 'Convert'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
