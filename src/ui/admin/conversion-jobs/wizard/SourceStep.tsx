/**
 * Source Selection Step
 *
 * First step of the conversion wizard - select source lesson and media
 *
 * @fileType component
 * @domain admin
 * @pattern wizard-step
 * @ai-summary First wizard step for source selection
 */

'use client'

import { useEffect, useState } from 'react'

interface Lesson {
  id: string
  title: string
}

interface MediaFile {
  id: string
  filename: string
  url?: string
  mimeType: string
}

interface SourceStepProps {
  lessonId: string
  mediaId: string
  onChange: (data: { lessonId: string; mediaId: string }) => void
  onValidationChange: (isValid: boolean) => void
}

export function SourceStep({ lessonId, mediaId, onChange, onValidationChange }: SourceStepProps) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [localLessonId, setLocalLessonId] = useState(lessonId)
  const [localMediaId, setLocalMediaId] = useState(mediaId)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        // Fetch lessons
        const lessonsRes = await fetch('/api/lessons?limit=100', { credentials: 'include' })
        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json()
          setLessons(lessonsData.docs || [])
        }

        // Fetch media files
        const mediaRes = await fetch('/api/media?limit=100', { credentials: 'include' })
        if (mediaRes.ok) {
          const mediaData = await mediaRes.json()
          setMediaFiles(
            (mediaData.docs || []).filter((m: MediaFile) => m.mimeType === 'application/pdf'),
          )
        }
      } catch (error) {
        console.error('Failed to fetch source data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    onValidationChange(Boolean(localLessonId && localMediaId))
  }, [localLessonId, localMediaId, onValidationChange])

  const handleLessonChange = (newLessonId: string) => {
    setLocalLessonId(newLessonId)
    onChange({ lessonId: newLessonId, mediaId: localMediaId })
  }

  const handleMediaChange = (newMediaId: string) => {
    setLocalMediaId(newMediaId)
    onChange({ lessonId: localLessonId, mediaId: newMediaId })
  }

  if (isLoading) {
    return (
      <div className="wizard-step source-step">
        <div className="step-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="wizard-step source-step">
      <h2>Select Source</h2>
      <p className="step-description">Choose the lesson and PDF source for conversion</p>

      <div className="form-group">
        <label htmlFor="lesson">Target Lesson</label>
        <select
          id="lesson"
          value={localLessonId}
          onChange={(e) => handleLessonChange(e.target.value)}
          className="form-select"
        >
          <option value="">Select a lesson...</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="media">PDF Source</label>
        <select
          id="media"
          value={localMediaId}
          onChange={(e) => handleMediaChange(e.target.value)}
          className="form-select"
          disabled={!localLessonId}
        >
          <option value="">Select a PDF...</option>
          {mediaFiles.map((media) => (
            <option key={media.id} value={media.id}>
              {media.filename}
            </option>
          ))}
        </select>
      </div>

      <style>{`
        .source-step { padding: 1rem; }
        .step-description { color: var(--theme-elevation-500); margin-bottom: 1.5rem; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 0.5rem; }
        .form-select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 4px;
          background: var(--theme-elevation-50);
        }
        .step-loading { text-align: center; padding: 2rem; color: var(--theme-elevation-500); }
      `}</style>
    </div>
  )
}
