'use client'

import { useState } from 'react'
import { useConversionPrompts } from '../hooks/useConversionPrompts'

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
 * Shows prompt selection dropdown before conversion.
 *
 * IMPORTANT: V3 conversion is extraction-only (no verification phase).
 * The selected extractor prompt is used for exercise generation only.
 * If/when verification is added to V3, the selected extractor prompt
 * should NOT be used as the verifier prompt - use a different verifier
 * or default (this is a forward-looking requirement per FR-3/FR-5).
 */
export function ConvertV3Button({ lessonId, mediaId }: ConvertV3ButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedPromptId, setSelectedPromptId] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)
  const [result, setResult] = useState<ConvertResult | null>(null)

  const {
    extractorPrompts,
    isLoading: isLoadingPrompts,
    error: promptsError,
    retry,
  } = useConversionPrompts(isExpanded ? lessonId : '')

  const handleExpand = () => {
    setIsExpanded(true)
    // Reset states when expanding
    setSelectedPromptId('')
    setConversionError(null)
    setResult(null)
  }

  const handleCancel = () => {
    setIsExpanded(false)
    setSelectedPromptId('')
    setConversionError(null)
  }

  const handleConvert = async () => {
    setIsConverting(true)
    setConversionError(null)
    setResult(null)

    try {
      const requestBody: { lessonId: string; mediaId: string; promptId?: string } = {
        lessonId,
        mediaId,
      }

      // Only include promptId if a specific prompt is selected (not default)
      if (selectedPromptId) {
        requestBody.promptId = selectedPromptId
      }

      const response = await fetch('/api/exercises/convert/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to convert exercise')
      }

      // Set result to show success message
      setResult(data.data)
    } catch (err) {
      setConversionError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsConverting(false)
    }
  }

  // Collapsed state: show simple button
  if (!isExpanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          onClick={handleExpand}
          disabled={!!result}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            border: 'none',
            borderRadius: 3,
            backgroundColor: result ? 'var(--theme-success)' : 'var(--theme-primary)',
            color: result ? 'var(--theme-elevation-0)' : 'var(--theme-primary-foreground)',
            cursor: result ? 'not-allowed' : 'pointer',
            opacity: result ? 0.6 : 1,
          }}
        >
          {result ? 'Created' : 'Convert V3'}
        </button>
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

  // Expanded state: show prompt selection
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 8,
        backgroundColor: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--theme-elevation-700)',
        }}
      >
        Select Extractor Prompt (V3)
      </div>

      {/* Error state from prompts */}
      {promptsError && (
        <div
          style={{
            padding: 6,
            fontSize: 10,
            color: 'var(--theme-error)',
            backgroundColor: 'var(--theme-error-100)',
            borderRadius: 3,
          }}
        >
          {promptsError}{' '}
          <button
            onClick={retry}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--theme-primary)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: 10,
              padding: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoadingPrompts && !promptsError && (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
          Loading prompts...
        </div>
      )}

      {/* Prompt selection dropdown */}
      {!isLoadingPrompts && !promptsError && (
        <select
          value={selectedPromptId}
          onChange={(e) => setSelectedPromptId(e.target.value)}
          style={{
            width: '100%',
            height: 28,
            padding: '0 8px',
            fontSize: 11,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-0)',
            color: 'var(--theme-elevation-1000)',
          }}
        >
          <option value="">Default prompt</option>
          {extractorPrompts.length === 0 && (
            <option value="" disabled>
              No extractor prompts configured
            </option>
          )}
          {extractorPrompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.title}
            </option>
          ))}
        </select>
      )}

      {/* Conversion error */}
      {conversionError && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--theme-error)',
          }}
        >
          {conversionError}
        </span>
      )}

      {/* Success result */}
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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button
          onClick={handleCancel}
          disabled={isConverting}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: 3,
            backgroundColor: 'var(--theme-elevation-100)',
            color: 'var(--theme-elevation-700)',
            cursor: isConverting ? 'not-allowed' : 'pointer',
            opacity: isConverting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConvert}
          disabled={isConverting || isLoadingPrompts || !!result}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 500,
            border: 'none',
            borderRadius: 3,
            backgroundColor: 'var(--theme-primary)',
            color: 'var(--theme-primary-foreground)',
            cursor: isConverting || isLoadingPrompts || result ? 'not-allowed' : 'pointer',
            opacity: isConverting || isLoadingPrompts || result ? 0.5 : 1,
          }}
        >
          {isConverting ? 'Converting...' : result ? 'Created' : 'Convert'}
        </button>
      </div>
    </div>
  )
}

export default ConvertV3Button
