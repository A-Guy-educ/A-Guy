'use client'

import { useEffect, useState } from 'react'

interface ConvertModalProps {
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

export function ConvertModal({ lessonId, mediaId, filename, onClose }: ConvertModalProps) {
  const [extractorPrompts, setExtractorPrompts] = useState<PromptOption[]>([])
  const [verifierPrompts, setVerifierPrompts] = useState<PromptOption[]>([])
  const [selectedExtractor, setSelectedExtractor] = useState<string>('')
  const [selectedVerifier, setSelectedVerifier] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function loadPrompts() {
      try {
        // Fetch prompts with overrideAccess: true via internal API
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
        setVerifierPrompts(data.verifiers || [])
      } catch (_err) {
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
          verifierPromptId: selectedVerifier,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Queue failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Convert PDF to Exercises</h2>
        <p className="filename">File: {filename}</p>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {isLoading ? (
          <div className="loading">Loading prompts...</div>
        ) : (
          <div className="modal-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="extractor">Extractor Prompt</label>
              <select
                id="extractor"
                value={selectedExtractor}
                onChange={(e) => setSelectedExtractor(e.target.value)}
                required
              >
                <option value="">Select extractor prompt...</option>
                {extractorPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} ({prompt.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="verifier">Verifier Prompt</label>
              <select
                id="verifier"
                value={selectedVerifier}
                onChange={(e) => setSelectedVerifier(e.target.value)}
                required
              >
                <option value="">Select verifier prompt...</option>
                {verifierPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} ({prompt.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedExtractor || !selectedVerifier}
              >
                {isSubmitting ? 'Queuing...' : 'Queue Conversion'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
