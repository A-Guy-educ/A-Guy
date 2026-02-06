/**
 * Conversion Form Component
 *
 * @fileType component
 * @domain admin
 * @pattern form
 * @ai-summary Form for configuring and starting PDF-to-exercise conversion
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { LessonSelector } from '../LessonSelector'
import { PdfSelector } from '../PdfSelector'
import {
  cardStyle,
  errorBannerStyle,
  fieldGroupStyle,
  labelStyle,
  sectionHeadingStyle,
  selectStyle,
  successBannerStyle,
} from '../styles'

interface PromptOption {
  id: string
  title: string
  key: string
  type: string
  usage: string
  status: string
}

interface LessonOption {
  id: string
  title: string
  chapterTitle?: string
}

interface ConversionFormProps {
  onQueued: () => void
}

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
}

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 16px',
  fontSize: 13,
  fontWeight: 500,
  backgroundColor: 'var(--theme-elevation-800)',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  marginTop: 8,
}

const submitButtonDisabledStyle: React.CSSProperties = {
  ...submitButtonStyle,
  backgroundColor: 'var(--theme-elevation-400)',
  cursor: 'not-allowed',
  opacity: 0.6,
}

export function ConversionForm({ onQueued }: ConversionFormProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [extractorPromptId, setExtractorPromptId] = useState<string>('')
  const [verifierPromptId, setVerifierPromptId] = useState<string>('')
  const [diagramPromptId, setDiagramPromptId] = useState<string>('')
  const [prompts, setPrompts] = useState<{
    extractors: PromptOption[]
    verifiers: PromptOption[]
    diagramGenerators: PromptOption[]
  }>({ extractors: [], verifiers: [], diagramGenerators: [] })
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!selectedLessonId) {
      setPrompts({ extractors: [], verifiers: [], diagramGenerators: [] })
      return
    }

    async function fetchPrompts() {
      setIsLoadingPrompts(true)
      setError(null)
      try {
        const response = await fetch('/api/prompts/for-conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: selectedLessonId }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to fetch prompts')
        }

        const data = await response.json()
        setPrompts({
          extractors: data.extractors || [],
          verifiers: data.verifiers || [],
          diagramGenerators: data.diagramGenerators || [],
        })
      } catch (err) {
        console.error('Failed to fetch prompts:', err)
        setError(err instanceof Error ? err.message : 'Failed to load prompts')
      } finally {
        setIsLoadingPrompts(false)
      }
    }

    fetchPrompts()
  }, [selectedLessonId])

  const handleLessonSelect = useCallback((lessonId: string, _lesson: LessonOption) => {
    setSelectedLessonId(lessonId)
    setSelectedMediaId(null)
    setExtractorPromptId('')
    setVerifierPromptId('')
    setDiagramPromptId('')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!selectedLessonId || !selectedMediaId || !extractorPromptId || !verifierPromptId) {
      setError('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const body: Record<string, string> = {
        lessonId: selectedLessonId,
        mediaId: selectedMediaId,
        extractorPromptId,
        verifierPromptId,
      }

      if (diagramPromptId) {
        body.diagramPromptId = diagramPromptId
      }

      const response = await fetch('/api/exercises/convert/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to queue conversion')
      }

      setSuccess(true)
      onQueued()

      // Reset form after 2 seconds
      setTimeout(() => {
        setSuccess(false)
        setSelectedLessonId(null)
        setSelectedMediaId(null)
        setExtractorPromptId('')
        setVerifierPromptId('')
        setDiagramPromptId('')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue conversion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = selectedLessonId && selectedMediaId && extractorPromptId && verifierPromptId

  return (
    <form style={cardStyle} onSubmit={handleSubmit}>
      <h2 style={sectionHeadingStyle}>Convert PDF to Exercises</h2>

      {error && <div style={errorBannerStyle}>{error}</div>}
      {success && <div style={successBannerStyle}>Conversion job queued successfully!</div>}

      <div style={fieldGroupStyle}>
        <LessonSelector selectedLessonId={selectedLessonId} onSelectLesson={handleLessonSelect} />
      </div>

      {selectedLessonId && (
        <div style={fieldGroupStyle}>
          <PdfSelector
            lessonId={selectedLessonId}
            selectedMediaId={selectedMediaId}
            onSelectMedia={setSelectedMediaId}
          />
        </div>
      )}

      {isLoadingPrompts ? (
        <div style={loadingStyle}>Loading prompts...</div>
      ) : (
        <>
          <div style={fieldGroupStyle}>
            <label htmlFor="extractor-prompt" style={labelStyle}>
              Extractor Prompt *
            </label>
            <select
              id="extractor-prompt"
              style={selectStyle}
              value={extractorPromptId}
              onChange={(e) => setExtractorPromptId(e.target.value)}
              required
            >
              <option value="">Select extractor prompt</option>
              {prompts.extractors.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label htmlFor="verifier-prompt" style={labelStyle}>
              Verifier Prompt *
            </label>
            <select
              id="verifier-prompt"
              style={selectStyle}
              value={verifierPromptId}
              onChange={(e) => setVerifierPromptId(e.target.value)}
              required
            >
              <option value="">Select verifier prompt</option>
              {prompts.verifiers.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldGroupStyle}>
            <label htmlFor="diagram-prompt" style={labelStyle}>
              Diagram Generator (optional)
            </label>
            <select
              id="diagram-prompt"
              style={selectStyle}
              value={diagramPromptId}
              onChange={(e) => setDiagramPromptId(e.target.value)}
            >
              <option value="">None</option>
              {prompts.diagramGenerators.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.title}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <button
        type="submit"
        style={isFormValid && !isSubmitting ? submitButtonStyle : submitButtonDisabledStyle}
        disabled={!isFormValid || isSubmitting}
      >
        {isSubmitting ? 'Queuing...' : 'Start Conversion'}
      </button>
    </form>
  )
}
