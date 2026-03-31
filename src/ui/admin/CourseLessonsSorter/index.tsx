'use client'

/**
 * CourseLessonsSorter
 *
 * @fileType component
 * @domain admin
 * @pattern lesson-sorting
 * @ai-summary Admin component to view and sort lessons within chapters for a course
 */

import { useDocumentInfo } from '@payloadcms/ui'
import { ChevronUp, ChevronDown, BookOpen, Folder } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

interface Lesson {
  id: string
  title: string
  order: number
  chapterId: string
}

interface Chapter {
  id: string
  title: string
  chapterLabel: string
  order: number
  lessons: Lesson[]
}

interface ChapterGroup {
  chapterId: string
  chapterLabel: string
  chapterTitle: string
  chapterOrder: number
  lessons: Lesson[]
}

/**
 * CourseLessonsSorter - Admin component for viewing and sorting lessons within chapters
 * Shows all lessons for a course, grouped by chapter, with up/down buttons to reorder
 */
export const CourseLessonsSorter: React.FC = () => {
  const { id: courseId } = useDocumentInfo()

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingLessonId, setSavingLessonId] = useState<string | null>(null)

  // Fetch chapters and lessons for this course
  useEffect(() => {
    async function fetchData() {
      if (!courseId) {
        setChapters([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Fetch chapters for this course, sorted by order
        const chaptersResponse = await fetch(
          `/api/chapters?where[course][equals]=${courseId}&sort=order&limit=100&depth=1`,
          { credentials: 'include' },
        )

        if (!chaptersResponse.ok) {
          throw new Error('Failed to fetch chapters')
        }

        const chaptersData = await chaptersResponse.json()

        if (!chaptersData.docs || chaptersData.docs.length === 0) {
          setChapters([])
          setIsLoading(false)
          return
        }

        // Build chapters with empty lessons arrays
        const chaptersWithLessons: Chapter[] = chaptersData.docs.map(
          (chapter: {
            id: string
            title: string
            chapterLabel?: string
            order: number
            lessons?: { id: string }[]
          }) => ({
            id: chapter.id,
            title: chapter.title || 'Untitled Chapter',
            chapterLabel: chapter.chapterLabel || '',
            order: chapter.order ?? 0,
            lessons: [],
          }),
        )

        // Fetch lessons for each chapter
        const chapterIds = chaptersWithLessons.map((c) => c.id)
        const lessonsPromises = chapterIds.map(async (chapterId) => {
          const lessonsResponse = await fetch(
            `/api/lessons?where[chapter][equals]=${chapterId}&sort=order&limit=100&depth=0`,
            { credentials: 'include' },
          )
          if (!lessonsResponse.ok) return []
          const lessonsData = await lessonsResponse.json()
          return (lessonsData.docs || []).map(
            (lesson: { id: string; title?: string; order?: number }) => ({
              id: lesson.id,
              title: lesson.title || 'Untitled Lesson',
              order: lesson.order ?? 0,
              chapterId,
            }),
          )
        })

        const lessonsArrays = await Promise.all(lessonsPromises)

        // Assign lessons to chapters
        chaptersWithLessons.forEach((chapter, index) => {
          chapter.lessons = lessonsArrays[index] || []
        })

        setChapters(chaptersWithLessons)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setChapters([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [courseId])

  // Group chapters with their lessons (for rendering)
  const chapterGroups: ChapterGroup[] = useMemo(() => {
    return chapters
      .filter((chapter) => chapter.lessons.length > 0)
      .map((chapter) => ({
        chapterId: chapter.id,
        chapterLabel: chapter.chapterLabel,
        chapterTitle: chapter.title,
        chapterOrder: chapter.order,
        lessons: [...chapter.lessons].sort((a, b) => a.order - b.order),
      }))
      .sort((a, b) => a.chapterOrder - b.chapterOrder)
  }, [chapters])

  // Move lesson within its chapter
  const moveLesson = useCallback(
    async (chapterId: string, fromIndex: number, toIndex: number) => {
      const chapter = chapters.find((c) => c.id === chapterId)
      if (!chapter) return
      if (toIndex < 0 || toIndex >= chapter.lessons.length) return

      // Save state before optimistic update for revert on failure
      const chaptersBeforeMove = chapters

      // Optimistic update
      const newChapters = [...chapters]
      const chapterIndex = newChapters.findIndex((c) => c.id === chapterId)
      const newLessons = [...chapter.lessons]
      const [moved] = newLessons.splice(fromIndex, 1)
      newLessons.splice(toIndex, 0, moved)

      // Update order values
      const updatedLessons = newLessons.map((lesson, idx) => ({
        ...lesson,
        order: idx,
      }))

      newChapters[chapterIndex] = { ...chapter, lessons: updatedLessons }
      setChapters(newChapters)

      // Persist the moved lesson's new order
      const lessonToUpdate = updatedLessons[toIndex]
      if (!lessonToUpdate) return

      setSavingLessonId(lessonToUpdate.id)

      try {
        const response = await fetch(`/api/lessons/${lessonToUpdate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ order: toIndex }),
        })

        if (!response.ok) {
          // Revert on failure
          setChapters(chaptersBeforeMove)
          setError('Failed to save order')
        }
      } catch {
        // Revert on failure
        setChapters(chaptersBeforeMove)
        setError('Failed to save order')
      } finally {
        setSavingLessonId(null)
      }
    },
    [chapters],
  )

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
        Loading lessons...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-error-500)' }}>
        {error}
      </div>
    )
  }

  if (chapterGroups.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
        No chapters or lessons found for this course.
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 12,
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--theme-text)',
        }}
      >
        Course Lessons
      </label>
      <p
        style={{
          fontSize: 12,
          color: 'var(--theme-elevation-500)',
          marginBottom: 12,
          marginTop: -4,
        }}
      >
        All lessons for this course, grouped by chapter. Use the arrows to reorder within each
        chapter.
      </p>

      {chapterGroups.map((group) => (
        <div key={group.chapterId} style={{ marginBottom: 24 }}>
          {/* Chapter header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: 'var(--theme-elevation-100)',
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <Folder size={14} style={{ color: 'var(--theme-elevation-400)' }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--theme-elevation-500)',
              }}
            >
              {group.chapterLabel || 'Chapter'}:
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--theme-text)',
              }}
            >
              {group.chapterTitle}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--theme-elevation-400)',
                marginLeft: 'auto',
              }}
            >
              {group.lessons.length} lesson{group.lessons.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Lessons list */}
          <div
            style={{
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {group.lessons.map((lesson, idx) => (
              <div
                key={lesson.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderBottom:
                    idx < group.lessons.length - 1
                      ? '1px solid var(--theme-elevation-100)'
                      : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--theme-elevation-50)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--theme-elevation-400)',
                    minWidth: 20,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                    background: 'var(--theme-success-100, #dcfce7)',
                    color: 'var(--theme-success-600, #16a34a)',
                  }}
                >
                  <BookOpen size={12} /> Lesson
                </span>

                <span
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: 'var(--theme-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lesson.title}
                </span>

                {savingLessonId === lesson.id && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--theme-elevation-400)',
                      fontStyle: 'italic',
                    }}
                  >
                    Saving...
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => moveLesson(group.chapterId, idx, idx - 1)}
                  disabled={idx === 0}
                  style={{
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    cursor: idx === 0 ? 'not-allowed' : 'pointer',
                    opacity: idx === 0 ? 0.2 : 0.6,
                    color: 'var(--theme-text)',
                    transition: 'all 0.2s',
                  }}
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveLesson(group.chapterId, idx, idx + 1)}
                  disabled={idx === group.lessons.length - 1}
                  style={{
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    cursor: idx === group.lessons.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: idx === group.lessons.length - 1 ? 0.2 : 0.6,
                    color: 'var(--theme-text)',
                    transition: 'all 0.2s',
                  }}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
