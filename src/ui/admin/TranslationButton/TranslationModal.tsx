'use client'

import { useEffect, useState } from 'react'

interface SelectOption {
  id: string
  title: string
}

interface TranslationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (params: {
    targetLocale: string
    promptId?: string
    targetCourseId?: string
    targetChapterId?: string
    targetLessonId?: string
  }) => void
  collectionSlug: 'courses' | 'chapters' | 'lessons' | 'exercises'
  isTranslating: boolean
  translationError?: string | null
  translationSuccess?: boolean
  translationResult?: {
    courseId?: string
    chapterId?: string
    lessonId?: string
    id?: string
    [key: string]: unknown
  } | null
}

const LABEL_STYLE = {
  display: 'block' as const,
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 6,
  color: 'var(--theme-elevation-700)',
}

const SELECT_STYLE = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-1000)',
}

export function TranslationModal({
  isOpen,
  onClose,
  onConfirm,
  collectionSlug,
  isTranslating,
  translationError,
  translationSuccess,
  translationResult,
}: TranslationModalProps) {
  const [targetLocale, setTargetLocale] = useState('en')
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [selectedLessonId, setSelectedLessonId] = useState('')

  const [prompts, setPrompts] = useState<SelectOption[]>([])
  const [courses, setCourses] = useState<SelectOption[]>([])
  const [chapters, setChapters] = useState<SelectOption[]>([])
  const [lessons, setLessons] = useState<SelectOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Which selectors are needed based on scope
  const needsCourse =
    collectionSlug === 'chapters' || collectionSlug === 'lessons' || collectionSlug === 'exercises'
  const needsChapter = collectionSlug === 'lessons' || collectionSlug === 'exercises'
  const needsLesson = collectionSlug === 'exercises'

  // Load prompts and courses on open
  useEffect(() => {
    if (!isOpen) return

    async function loadInitialData() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const fetches: Promise<void>[] = []

        // Load prompts
        fetches.push(
          fetch(
            '/api/prompts?where[usage][equals]=translator&where[status][equals]=published&limit=50',
            { credentials: 'include' },
          )
            .then((r) => r.json())
            .then((data) => {
              setPrompts(
                (data.docs || []).map((d: Record<string, unknown>) => ({
                  id: d.id as string,
                  title: d.title as string,
                })),
              )
            }),
        )

        // Load courses if needed
        if (needsCourse) {
          fetches.push(
            fetch('/api/courses?limit=200&sort=title', { credentials: 'include' })
              .then((r) => r.json())
              .then((data) => {
                setCourses(
                  (data.docs || []).map((d: Record<string, unknown>) => ({
                    id: d.id as string,
                    title: (d.title as string) || (d.id as string),
                  })),
                )
              }),
          )
        }

        await Promise.all(fetches)
      } catch {
        setLoadError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [isOpen, needsCourse])

  // Load chapters when course is selected
  useEffect(() => {
    if (!needsChapter || !selectedCourseId) {
      setChapters([])
      setSelectedChapterId('')
      return
    }

    let cancelled = false

    fetch(`/api/chapters?where[course][equals]=${selectedCourseId}&limit=200&sort=order`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setChapters(
          (data.docs || []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            title: (d.adminTitle as string) || (d.title as string) || (d.id as string),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setChapters([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedCourseId, needsChapter])

  // Load lessons when chapter is selected
  useEffect(() => {
    if (!needsLesson || !selectedChapterId) {
      setLessons([])
      setSelectedLessonId('')
      return
    }

    let cancelled = false

    fetch(`/api/lessons?where[chapter][equals]=${selectedChapterId}&limit=200&sort=order`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setLessons(
          (data.docs || []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            title: (d.title as string) || (d.id as string),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setLessons([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedChapterId, needsLesson])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPromptId('')
      setSelectedCourseId('')
      setSelectedChapterId('')
      setSelectedLessonId('')
      setTargetLocale('en')
      setLoadError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const error = loadError || translationError

  const canTranslate =
    !isLoading &&
    !isTranslating &&
    (!needsCourse || selectedCourseId) &&
    (!needsChapter || selectedChapterId) &&
    (!needsLesson || selectedLessonId)

  const scopeLabel =
    collectionSlug === 'courses'
      ? 'Course'
      : collectionSlug === 'chapters'
        ? 'Chapter'
        : collectionSlug === 'lessons'
          ? 'Lesson'
          : 'Exercise'

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
        if (e.target === e.currentTarget && !isTranslating) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          borderRadius: 8,
          padding: 24,
          width: '90%',
          maxWidth: 480,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--theme-elevation-1000)',
          }}
        >
          Translate {scopeLabel}
        </h3>

        {isLoading && (
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)', padding: 20 }}>
            Loading...
          </div>
        )}

        {!isLoading && !translationSuccess && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Target Language */}
            <div>
              <label style={LABEL_STYLE}>Target Language</label>
              <select
                value={targetLocale}
                onChange={(e) => setTargetLocale(e.target.value)}
                disabled={isTranslating}
                style={SELECT_STYLE}
              >
                <option value="en">English</option>
                <option value="he">Hebrew</option>
              </select>
            </div>

            {/* Target Course (for chapters, lessons, exercises) */}
            {needsCourse && (
              <div>
                <label style={LABEL_STYLE}>Target Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value)
                    setSelectedChapterId('')
                    setSelectedLessonId('')
                  }}
                  disabled={isTranslating}
                  style={SELECT_STYLE}
                >
                  <option value="">-- Select a course --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Chapter (for lessons, exercises) */}
            {needsChapter && (
              <div>
                <label style={LABEL_STYLE}>Target Chapter</label>
                <select
                  value={selectedChapterId}
                  onChange={(e) => {
                    setSelectedChapterId(e.target.value)
                    setSelectedLessonId('')
                  }}
                  disabled={isTranslating || !selectedCourseId}
                  style={{
                    ...SELECT_STYLE,
                    opacity: selectedCourseId ? 1 : 0.5,
                  }}
                >
                  <option value="">
                    {!selectedCourseId
                      ? '-- Select a course first --'
                      : chapters.length === 0
                        ? '-- No chapters found --'
                        : '-- Select a chapter --'}
                  </option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Lesson (for exercises) */}
            {needsLesson && (
              <div>
                <label style={LABEL_STYLE}>Target Lesson</label>
                <select
                  value={selectedLessonId}
                  onChange={(e) => setSelectedLessonId(e.target.value)}
                  disabled={isTranslating || !selectedChapterId}
                  style={{
                    ...SELECT_STYLE,
                    opacity: selectedChapterId ? 1 : 0.5,
                  }}
                >
                  <option value="">
                    {!selectedChapterId
                      ? '-- Select a chapter first --'
                      : lessons.length === 0
                        ? '-- No lessons found --'
                        : '-- Select a lesson --'}
                  </option>
                  {lessons.map((ls) => (
                    <option key={ls.id} value={ls.id}>
                      {ls.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Translation Prompt */}
            <div>
              <label style={LABEL_STYLE}>
                Translation Prompt{' '}
                {prompts.length === 0 && (
                  <span style={{ fontWeight: 400 }}>(none available — uses default)</span>
                )}
              </label>
              {prompts.length > 0 && (
                <select
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  disabled={isTranslating}
                  style={SELECT_STYLE}
                >
                  <option value="">-- Use default prompt --</option>
                  {prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--theme-error)',
              padding: '8px 12px',
              backgroundColor: 'var(--theme-error-100)',
              borderRadius: 4,
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* Success */}
        {translationSuccess && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--theme-success)',
              padding: '10px 14px',
              backgroundColor: 'var(--theme-success-100)',
              borderRadius: 4,
              marginBottom: 12,
            }}
          >
            Translation complete!
            {translationResult?.courseId && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={`/admin/collections/courses/${translationResult.courseId}`}
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  View translated course
                </a>
              </div>
            )}
            {translationResult?.chapterId && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={`/admin/collections/chapters/${translationResult.chapterId}`}
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  View translated chapter
                </a>
              </div>
            )}
            {translationResult?.lessonId && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={`/admin/collections/lessons/${translationResult.lessonId}`}
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  View translated lesson
                </a>
              </div>
            )}
            {translationResult?.id &&
              !translationResult?.courseId &&
              !translationResult?.chapterId &&
              !translationResult?.lessonId && (
                <div style={{ marginTop: 6 }}>
                  <a
                    href={`/admin/collections/exercises/${translationResult.id}`}
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    View translated exercise
                  </a>
                </div>
              )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          {translationSuccess ? (
            <button
              onClick={onClose}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'var(--theme-success)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              OK
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isTranslating}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  backgroundColor: 'var(--theme-elevation-0)',
                  color: 'var(--theme-elevation-700)',
                  cursor: isTranslating ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onConfirm({
                    targetLocale,
                    promptId: selectedPromptId || undefined,
                    targetCourseId: selectedCourseId || undefined,
                    targetChapterId: selectedChapterId || undefined,
                    targetLessonId: selectedLessonId || undefined,
                  })
                }
                disabled={!canTranslate}
                style={{
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid var(--theme-elevation-200)',
                  borderRadius: 4,
                  backgroundColor: canTranslate
                    ? 'var(--theme-elevation-100)'
                    : 'var(--theme-elevation-50)',
                  color: canTranslate
                    ? 'var(--theme-elevation-1000)'
                    : 'var(--theme-elevation-400)',
                  cursor: canTranslate ? 'pointer' : 'not-allowed',
                }}
              >
                {isTranslating ? 'Translating...' : 'Translate'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
