'use client'

import { useField } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

interface ConvertContextModalProps {
  lessonId: string
  mediaId: string
  filename: string
  isOpen: boolean
  onClose: () => void
}

interface PromptOption {
  id: string
  title: string
  promptKey: string
  type: string
  usage: string
  status: string
}

export function ConvertContextModal({
  lessonId,
  mediaId,
  filename,
  isOpen,
  onClose,
}: ConvertContextModalProps) {
  const [prompts, setPrompts] = useState<PromptOption[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isConverting, setIsConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Get the lessonContextText field for updating using useField pattern
  const { setValue: setContextText } = useField<string>({ path: 'lessonContextText' })

  // Load prompts when modal opens
  useEffect(() => {
    if (!isOpen) return

    async function loadPrompts() {
      setIsLoading(true)
      setError(null)
      setSuccess(null)

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
        setPrompts(data.contextExtractors || [])
      } catch {
        setError('Failed to load prompts')
      } finally {
        setIsLoading(false)
      }
    }

    loadPrompts()
  }, [isOpen, lessonId])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedPromptId('')
      setError(null)
      setSuccess(null)
    }
  }, [isOpen])

  async function handleConvert() {
    if (!selectedPromptId) {
      setError('Please select a prompt')
      return
    }

    setIsConverting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/lessons/convert-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId,
          mediaId,
          promptId: selectedPromptId,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Conversion failed')
      }

      const data = await response.json()

      // Update the form field with the new context text
      if (data.data?.updatedContextText) {
        setContextText(data.data.updatedContextText)
      }

      const charCount = data.data?.extractedChunkLength || 0
      setSuccess(`Extracted ${charCount} characters! Context text updated.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setIsConverting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          borderRadius: 8,
          padding: 20,
          width: '90%',
          maxWidth: 450,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 4,
            color: 'var(--theme-elevation-1000)',
          }}
        >
          Convert Context
        </h3>
        <p
          style={{
            fontSize: 12,
            color: 'var(--theme-elevation-500)',
            marginBottom: 16,
          }}
        >
          Extract context text from {filename}
        </p>

        {/* Loading state */}
        {isLoading && (
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', padding: 20 }}>
            Loading prompts...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && prompts.length === 0 && !error && (
          <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', padding: 20 }}>
            No context extractor prompts available for this lesson.
          </div>
        )}

        {/* Prompt selection */}
        {!isLoading && prompts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 6,
                color: 'var(--theme-elevation-700)',
              }}
            >
              Select Prompt
            </label>
            <select
              value={selectedPromptId}
              onChange={(e) => setSelectedPromptId(e.target.value)}
              disabled={isConverting}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                border: '1px solid var(--theme-elevation-200)',
                borderRadius: 4,
                backgroundColor: 'var(--theme-elevation-0)',
                color: 'var(--theme-elevation-1000)',
                opacity: isConverting ? 0.6 : 1,
              }}
            >
              <option value="">-- Select a prompt --</option>
              {prompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--theme-error)',
              padding: '8px 12px',
              backgroundColor: 'var(--theme-error-100)',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Success state */}
        {success && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--theme-success)',
              padding: '8px 12px',
              backgroundColor: 'var(--theme-success-100)',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            {success}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isConverting}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid var(--theme-elevation-200)',
              borderRadius: 4,
              backgroundColor: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-700)',
              cursor: isConverting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={isConverting || isLoading || prompts.length === 0 || !!success}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              borderRadius: 4,
              backgroundColor: success
                ? 'var(--theme-success)'
                : isConverting
                  ? 'var(--theme-elevation-400)'
                  : 'var(--theme-primary)',
              color: 'var(--theme-elevation-0)',
              cursor: isConverting || success ? 'not-allowed' : 'pointer',
              opacity: isConverting ? 0.6 : 1,
            }}
          >
            {isConverting ? 'Extracting...' : success ? 'Done' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConvertContextModal
