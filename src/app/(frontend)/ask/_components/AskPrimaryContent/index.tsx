'use client'

import { interactiveLessonToGuidedExplanation } from '@/infra/llm/services/interactive-lesson/lesson-to-guided-explanation'
import { GuidedExplanationRunner } from '@/ui/web/GuidedExplanationRunner'
import { useLocale, useTranslations } from '@/ui/web/providers/I18n'
import { ArrowRight, Loader2, PlusCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { AskMediaAttachEvent, AskMediaRestoreEvent, ExerciseFile } from '../ask-types'
import {
  ASK_MEDIA_ATTACH_EVENT,
  ASK_MEDIA_CLEAR_EVENT,
  ASK_MEDIA_RESTORE_EVENT,
} from '../ask-types'
import { AskExerciseCard } from '../AskExerciseCard'
import { useGenerateLesson } from '../InteractivePlayer/useGenerateLesson'

function dispatchMediaAttach(detail: AskMediaAttachEvent) {
  window.dispatchEvent(new CustomEvent(ASK_MEDIA_ATTACH_EVENT, { detail }))
}

export function AskPrimaryContent() {
  const t = useTranslations('homepage.ask')
  const locale = useLocale()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentFile, setCurrentFile] = useState<ExerciseFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  // Hides the player without discarding the lesson, so user can return to the
  // exercise card view (image + buttons) and re-enter the same lesson via
  // the Resume button without regenerating.
  const [showPlayer, setShowPlayer] = useState(true)
  const { lesson, status, error, generate, reset: resetLesson } = useGenerateLesson()

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (currentFile?.url.startsWith('blob:')) URL.revokeObjectURL(currentFile.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only
  }, [])

  // Clear image when AI rejects it so student can upload a new one
  useEffect(() => {
    const handler = () => {
      if (currentFile?.url.startsWith('blob:')) URL.revokeObjectURL(currentFile.url)
      setCurrentFile(null)
    }
    window.addEventListener(ASK_MEDIA_CLEAR_EVENT, handler)
    return () => window.removeEventListener(ASK_MEDIA_CLEAR_EVENT, handler)
  }, [currentFile])

  // Restore image from conversation history
  useEffect(() => {
    const handler = (e: Event) => {
      const { mediaId, filename, url } = (e as CustomEvent<AskMediaRestoreEvent>).detail
      setCurrentFile({
        id: Date.now(),
        title: filename.replace(/\.[^/.]+$/, '') || 'Uploaded image',
        url,
        date: '',
        mediaId,
        isUploading: false,
      })
      dispatchMediaAttach({ mediaId, filename })
    }
    window.addEventListener(ASK_MEDIA_RESTORE_EVENT, handler)
    return () => window.removeEventListener(ASK_MEDIA_RESTORE_EVENT, handler)
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (currentFile?.url.startsWith('blob:')) URL.revokeObjectURL(currentFile.url)

    const previewUrl = URL.createObjectURL(file)
    const title = file.name.replace(/\.[^/.]+$/, '')
    const fileId = Date.now()
    setCurrentFile({
      id: fileId,
      title,
      url: previewUrl,
      date: new Date().toLocaleDateString('he-IL'),
      isUploading: true,
    })
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!response.ok) throw new Error('Upload failed')
      const doc = await response.json()
      const mediaId = doc.doc?.id || doc.id
      const filename = doc.doc?.filename || doc.filename || file.name
      setCurrentFile((prev) =>
        prev && prev.id === fileId ? { ...prev, mediaId, isUploading: false } : prev,
      )
      dispatchMediaAttach({ mediaId, filename })
    } catch {
      toast.error(t('uploadFailed'))
      URL.revokeObjectURL(previewUrl)
      setCurrentFile(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleGenerate = () => {
    if (!currentFile?.mediaId || status === 'generating') return
    setShowPlayer(true)
    generate(currentFile.mediaId, locale === 'he' ? 'he' : 'en')
  }

  // Hide the player but keep the image + lesson intact, so the user can
  // re-enter via "Resume" without regenerating.
  const handleBackToExercise = () => {
    setShowPlayer(false)
  }

  // Re-enter the existing player without regenerating.
  const handleResumePlayer = () => {
    setShowPlayer(true)
  }

  // Full reset — clears everything including the lesson and the image.
  const handleStartOver = () => {
    if (currentFile?.url.startsWith('blob:')) URL.revokeObjectURL(currentFile.url)
    setCurrentFile(null)
    resetLesson()
    setShowPlayer(true)
  }

  const guidedPayload = lesson ? interactiveLessonToGuidedExplanation(lesson) : null

  // Full-screen player takeover (only when explicitly showing it)
  if (status === 'done' && guidedPayload && showPlayer) {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={handleBackToExercise}
          className="flex items-center gap-content-gap-xs px-4 py-2 text-body-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          {t('backToUpload')}
        </button>
        <div className="flex-1 overflow-auto py-section-xs">
          <GuidedExplanationRunner payload={guidedPayload} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-card-padding md:p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-10 text-center md:text-right">
          <h1 className="text-display-md font-black mb-2">{t('pageTitle')}</h1>
          <p className="text-muted-foreground">{t('pageSubtitle')}</p>
        </header>

        {!currentFile?.mediaId && (
          <div className="flex justify-center mb-10">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-3 px-8 py-content-gap rounded-2xl font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-normal shadow-elevation-3 hover:shadow-elevation-4 hover:-translate-y-0.5 group disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <PlusCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-slow" />
              )}
              <span>{t('uploadButton')}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}

        {/* Generation loading/error */}
        {status === 'generating' && (
          <div className="flex items-center justify-center gap-3 py-section-sm">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-body-md font-medium text-primary">{t('generatingLesson')}</span>
          </div>
        )}
        {status === 'error' && error && (
          <div className="px-5 py-3 mb-4 rounded-xl bg-error/5 border border-error/20">
            <p className="text-body-sm text-error">{error}</p>
          </div>
        )}

        {currentFile && (
          <AskExerciseCard
            file={currentFile}
            onGenerate={handleGenerate}
            generationStatus={status}
            hasLesson={status === 'done' && !!guidedPayload}
            onResumeLesson={handleResumePlayer}
            onStartOver={handleStartOver}
          />
        )}
      </div>
    </div>
  )
}
