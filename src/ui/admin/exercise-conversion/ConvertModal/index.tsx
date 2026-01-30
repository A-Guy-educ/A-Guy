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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-1">Convert PDF to Exercises</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mb-4">File: {filename}</p>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded p-3 mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded p-3 mb-4">
            {success}
          </div>
        )}

        {isLoading ? (
          <div className="text-zinc-500">Loading prompts...</div>
        ) : (
          <div>
            <div className="mb-4">
              <label htmlFor="extractor" className="block font-medium mb-1">
                Extractor Prompt
              </label>
              <select
                id="extractor"
                value={selectedExtractor}
                onChange={(e) => setSelectedExtractor(e.target.value)}
                required
                className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
              >
                <option value="">Select extractor prompt...</option>
                {extractorPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} ({prompt.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="verifier" className="block font-medium mb-1">
                Verifier Prompt
              </label>
              <select
                id="verifier"
                value={selectedVerifier}
                onChange={(e) => setSelectedVerifier(e.target.value)}
                required
                className="w-full p-2 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800"
              >
                <option value="">Select verifier prompt...</option>
                {verifierPrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.title} ({prompt.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                type="button"
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
