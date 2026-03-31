'use client'

import { useState, useEffect, useCallback } from 'react'

import { cn } from '@/infra/utils/ui'
import type { LessonRef } from '@/server/services/study-plan'
import { useTranslations } from '@/ui/web/providers/I18n'
import { ChevronDown, ChevronRight, Check, Loader2, AlertCircle, BookOpen } from 'lucide-react'

// =============================================================================
// Types (mirrored from API response)
// =============================================================================

interface SyllabusLesson {
  lessonId: string
  lessonTitle: string
  lessonSlug: string
  lessonOrder: number
  lessonType: 'learning' | 'practice' | 'exam'
  lessonUrl: string
}

interface SyllabusChapter {
  chapterId: string
  chapterLabel: string
  chapterTitle: string
  chapterSlug: string
  lessons: SyllabusLesson[]
}

// =============================================================================
// Component
// =============================================================================

interface LessonSelectorProps {
  courseId: string
  onAddLessons: (lessonRefs: LessonRef[]) => void
}

const LESSON_TYPE_COLORS = {
  learning: 'bg-primary/10 text-primary border-primary/20',
  practice: 'bg-accent/10 text-accent border-accent/20',
  exam: 'bg-error/10 text-error border-error/20',
} as const

export function LessonSelector({ courseId, onAddLessons }: LessonSelectorProps) {
  const t = useTranslations('studyPlan')

  const [syllabus, setSyllabus] = useState<SyllabusChapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set())
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set())

  // Fetch syllabus on mount or courseId change
  useEffect(() => {
    const controller = new AbortController()

    async function fetchSyllabus() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(
          `/api/course-syllabus?courseId=${encodeURIComponent(courseId)}`,
          {
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          throw new Error('Failed to fetch syllabus')
        }

        const data = await response.json()

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Failed to fetch syllabus')
        }

        setSyllabus(data.data)

        // Auto-open first chapter
        if (data.data.length > 0) {
          setOpenChapters(new Set([data.data[0].chapterId]))
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchSyllabus()

    return () => controller.abort()
  }, [courseId])

  const toggleChapter = useCallback((chapterId: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) {
        next.delete(chapterId)
      } else {
        next.add(chapterId)
      }
      return next
    })
  }, [])

  const toggleLesson = useCallback((lessonId: string) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev)
      if (next.has(lessonId)) {
        next.delete(lessonId)
      } else {
        next.add(lessonId)
      }
      return next
    })
  }, [])

  const handleAddSelected = useCallback(() => {
    const lessonRefs: LessonRef[] = []

    for (const chapter of syllabus) {
      for (const lesson of chapter.lessons) {
        if (selectedLessonIds.has(lesson.lessonId)) {
          // Extract courseSlug from the first lesson's URL: /courses/{courseSlug}/...
          const urlParts = lesson.lessonUrl.split('/')
          const courseSlugIndex = urlParts.indexOf('courses')
          const courseSlug = courseSlugIndex !== -1 ? (urlParts[courseSlugIndex + 1] ?? '') : ''

          lessonRefs.push({
            lessonId: lesson.lessonId,
            lessonSlug: lesson.lessonSlug,
            chapterSlug: chapter.chapterSlug,
            courseSlug,
            lessonUrl: lesson.lessonUrl,
          })
        }
      }
    }

    if (lessonRefs.length > 0) {
      onAddLessons(lessonRefs)
      setSelectedLessonIds(new Set())
    }
  }, [syllabus, selectedLessonIds, onAddLessons])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-section-md">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-body-sm text-muted-foreground">{t('loading')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-section-xs text-error text-body-sm">
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
      </div>
    )
  }

  if (syllabus.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-section-md text-center">
        <BookOpen className="w-8 h-8 text-muted-foreground/50 mb-2" />
        <p className="text-body-sm text-muted-foreground">{t('noCourseSelected')}</p>
      </div>
    )
  }

  const selectedCount = selectedLessonIds.size

  return (
    <div className="space-y-3">
      {/* Chapter list */}
      <div className="max-h-64 overflow-y-auto space-y-1">
        {syllabus.map((chapter) => {
          const isOpen = openChapters.has(chapter.chapterId)
          const chapterSelectedCount = chapter.lessons.filter((l) =>
            selectedLessonIds.has(l.lessonId),
          ).length

          return (
            <div
              key={chapter.chapterId}
              className="rounded-lg border border-border overflow-hidden"
            >
              {/* Chapter header */}
              <button
                type="button"
                onClick={() => toggleChapter(chapter.chapterId)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted transition-colors duration-normal text-left"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-body-xs font-semibold text-foreground">
                  {chapter.chapterLabel}
                </span>
                <span className="text-body-xs text-muted-foreground truncate">
                  {chapter.chapterTitle}
                </span>
                {chapterSelectedCount > 0 && (
                  <span className="ml-auto text-body-xs font-medium text-primary">
                    {chapterSelectedCount}
                  </span>
                )}
              </button>

              {/* Lessons */}
              {isOpen && (
                <div className="divide-y divide-border">
                  {chapter.lessons.map((lesson) => {
                    const isSelected = selectedLessonIds.has(lesson.lessonId)

                    return (
                      <button
                        key={lesson.lessonId}
                        type="button"
                        onClick={() => toggleLesson(lesson.lessonId)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-normal',
                          isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30',
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors duration-normal',
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/30 bg-card',
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>

                        {/* Lesson title */}
                        <span className="flex-1 text-body-xs text-foreground truncate">
                          {lesson.lessonTitle}
                        </span>

                        {/* Type badge */}
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-body-xs font-medium rounded border flex-shrink-0',
                            LESSON_TYPE_COLORS[lesson.lessonType],
                          )}
                        >
                          {t(`lessonTypes.${lesson.lessonType}`)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add selected button */}
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={handleAddSelected}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg text-body-sm font-medium hover:bg-primary/90 transition-colors duration-normal"
        >
          {selectedCount === 1
            ? `${selectedCount} ${t('selectedCount')}`
            : `${selectedCount} ${t('selectedCount_plural')}`}
        </button>
      )}
    </div>
  )
}
