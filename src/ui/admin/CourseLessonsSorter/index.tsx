'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentInfo, useForm, useTranslation } from '@payloadcms/ui'
import { GripVertical, ChevronUp, ChevronDown, BookOpen, Pencil, ClipboardList } from 'lucide-react'

import { getStrings } from './strings'

// Types for the Payload documents we fetch
interface ChapterDoc {
  id: string
  title: string
  chapterLabel: string | null
  order: number
}

interface LessonDoc {
  id: string
  title: string
  type: 'learning' | 'practice' | 'exam'
  order: number
  chapter: string | { id: string }
}

interface GroupedChapter {
  chapter: ChapterDoc
  lessons: LessonDoc[]
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

const containerStyle: React.CSSProperties = {
  marginBottom: 32,
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 6,
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-50)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const chapterHeaderStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--theme-elevation-100)',
  borderBottom: '1px solid var(--theme-elevation-150)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const chapterTitleLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--theme-text)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  transition: 'color 0.15s',
}

const lessonRowStyle = (
  isDragging: boolean,
  isDropTarget: boolean,
  idx: number,
  total: number,
): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px 8px 16px',
  borderBottom: idx < total - 1 ? '1px solid var(--theme-elevation-100)' : 'none',
  background: isDropTarget
    ? 'var(--theme-elevation-100)'
    : isDragging
      ? 'var(--theme-elevation-50)'
      : idx % 2 === 0
        ? 'transparent'
        : 'var(--theme-elevation-50)',
  opacity: isDragging ? 0.5 : 1,
  borderTop: isDropTarget ? '2px solid var(--theme-success-500, #22c55e)' : 'none',
  transition: 'background 0.15s, opacity 0.15s',
  minHeight: 40,
  cursor: 'grab', // must be on the draggable row, not a child span (draggable forces cursor:default on the element)
})

const lessonIndexStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--theme-elevation-400)',
  minWidth: 20,
  textAlign: 'center',
  flexShrink: 0,
}

const typeBadgeStyle = (type: 'learning' | 'practice' | 'exam'): React.CSSProperties => {
  const isLearning = type === 'learning'
  const isPractice = type === 'practice'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
    background: isLearning
      ? 'var(--theme-success-100, #dcfce7)'
      : isPractice
        ? 'var(--theme-warning-100, #fef3c7)'
        : 'var(--theme-error-100, #fee2e2)',
    color: isLearning
      ? 'var(--theme-success-600, #16a34a)'
      : isPractice
        ? 'var(--theme-warning-600, #ca8a04)'
        : 'var(--theme-error-600, #dc2626)',
  }
}

const lessonTitleLinkStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  color: 'var(--theme-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  transition: 'color 0.15s',
}

const chevronBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: 4,
  border: 'none',
  background: 'transparent',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.2 : 0.6,
  color: 'var(--theme-text)',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
})

const stateMessageStyle: React.CSSProperties = {
  padding: '24px 16px',
  textAlign: 'center',
  color: 'var(--theme-elevation-400)',
  fontSize: 13,
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--theme-elevation-500)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  flexShrink: 0,
}

const filterBarStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderBottom: '1px solid var(--theme-elevation-150)',
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
  ...(active
    ? {
        background: 'var(--theme-elevation-800)',
        borderColor: 'var(--theme-elevation-800)',
        color: 'var(--theme-elevation-50)',
      }
    : {
        background: 'transparent',
        borderColor: 'var(--theme-elevation-200)',
        color: 'var(--theme-text)',
      }),
})

export const CourseLessonsSorter: React.FC = () => {
  const { id } = useDocumentInfo()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)
  const { setModified } = useForm()

  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [chapters, setChapters] = useState<GroupedChapter[]>([])
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [dragChapterId, setDragChapterId] = useState<string | null>(null)
  const [dragLessonId, setDragLessonId] = useState<string | null>(null)
  const [dropTargetIdx, setDropTargetIdx] = useState<{ chapterId: string; idx: number } | null>(
    null,
  )
  const [activeFilter, setActiveFilter] = useState<'all' | 'learning' | 'practice' | 'exam'>('all')

  // Keep a ref to the latest chapters state so moveLesson can access it without stale-closure issues
  const chaptersRef = useRef<GroupedChapter[]>([])
  useEffect(() => {
    chaptersRef.current = chapters
  }, [chapters])

  // Fetch chapters and lessons on mount using Payload REST API
  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      setLoadingState('loading')
      try {
        // Fetch chapters for this course, sorted by order
        const chaptersParams = new URLSearchParams({
          'where[course][equals]': id as string,
          sort: 'order',
          limit: '1000',
          depth: '0',
        })
        const chaptersRes = await fetch(`/api/chapters?${chaptersParams}`, {
          credentials: 'include',
        })
        if (!chaptersRes.ok) throw new Error('chapters fetch failed')
        const chaptersData = await chaptersRes.json()
        const fetchedChapters: ChapterDoc[] = chaptersData.docs ?? []

        // Fetch all lessons for this course, sorted by order
        const lessonsParams = new URLSearchParams({
          'where[course][equals]': id as string,
          sort: 'order',
          limit: '1000',
          depth: '0',
        })
        const lessonsRes = await fetch(`/api/lessons?${lessonsParams}`, {
          credentials: 'include',
        })
        if (!lessonsRes.ok) throw new Error('lessons fetch failed')
        const lessonsData = await lessonsRes.json()
        const fetchedLessons: LessonDoc[] = lessonsData.docs ?? []

        // Group lessons by chapter.id
        const chapterMap = new Map<string, LessonDoc[]>()

        for (const lesson of fetchedLessons) {
          const chapterId = typeof lesson.chapter === 'string' ? lesson.chapter : lesson.chapter?.id
          if (!chapterId) continue
          if (!chapterMap.has(chapterId)) {
            chapterMap.set(chapterId, [])
          }
          chapterMap.get(chapterId)!.push(lesson)
        }

        // Sort lessons within each chapter by order (already sorted from API, but double-check)
        for (const [, lessons] of chapterMap) {
          lessons.sort((a, b) => a.order - b.order)
        }

        const grouped: GroupedChapter[] = fetchedChapters
          .map((ch) => ({
            chapter: ch,
            lessons: chapterMap.get(ch.id) ?? [],
          }))
          .filter((g) => g.lessons.length > 0)

        setChapters(grouped)
        setLoadingState('success')
      } catch (err) {
        console.error('[CourseLessonsSorter] failed to load:', err)
        setErrorMsg(s.failedToLoad)
        setLoadingState('error')
      }
    }

    fetchData()
  }, [id, s.failedToLoad])

  // Move lesson within chapter using chevron buttons or drag-and-drop
  const moveLesson = useCallback(
    async (chapterId: string, fromIdx: number, toIdx: number) => {
      if (toIdx < 0) return

      // Read from ref to avoid stale-closure issues with rapid calls
      const currentGroup = chaptersRef.current.find((g) => g.chapter.id === chapterId)
      if (!currentGroup) return

      const reorderedLessons = [...currentGroup.lessons]
      const [moved] = reorderedLessons.splice(fromIdx, 1)
      reorderedLessons.splice(toIdx, 0, moved)

      // Snapshot prev state for rollback on PATCH failure
      const snapshot = chaptersRef.current

      // Optimistic update
      setChapters((prev) =>
        prev.map((g) => {
          if (g.chapter.id !== chapterId) return g
          return { ...g, lessons: reorderedLessons }
        }),
      )

      // Tell Payload's form the field is dirty so the Save button becomes enabled
      setModified(true)

      // Persist new order values via PATCH
      try {
        await Promise.all(
          reorderedLessons.map((lesson, idx) =>
            fetch(`/api/lessons/${lesson.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ order: idx }),
            }),
          ),
        )
      } catch (err) {
        console.error('[CourseLessonsSorter] failed to reorder:', err)
        setErrorMsg(s.failedToReorder)
        setChapters(snapshot)
      }
    },
    [s.failedToReorder, setModified],
  )

  // Drag-and-drop handlers
  const handleDragStart = useCallback((chapterId: string, lessonId: string) => {
    setDragChapterId(chapterId)
    setDragLessonId(lessonId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, chapterId: string, idx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetIdx({ chapterId, idx })
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTargetIdx(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, chapterId: string, toIdx: number) => {
      e.preventDefault()
      setDragChapterId(null)
      setDragLessonId(null)
      setDropTargetIdx(null)

      if (!dragLessonId || !dragChapterId || dragChapterId !== chapterId) return

      const group = chapters.find((g) => g.chapter.id === chapterId)
      if (!group) return

      const fromIdx = group.lessons.findIndex((l) => l.id === dragLessonId)
      if (fromIdx === -1 || fromIdx === toIdx) return

      moveLesson(chapterId, fromIdx, toIdx)
    },
    [dragLessonId, dragChapterId, chapters, moveLesson],
  )

  const handleDragEnd = useCallback(() => {
    setDragChapterId(null)
    setDragLessonId(null)
    setDropTargetIdx(null)
  }, [])

  if (loadingState === 'idle' || loadingState === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={sectionLabelStyle}>{s.courseLessons}</span>
        </div>
        <div style={stateMessageStyle}>{s.loading}</div>
      </div>
    )
  }

  if (loadingState === 'error') {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={sectionLabelStyle}>{s.courseLessons}</span>
        </div>
        <div style={{ ...stateMessageStyle, color: 'var(--theme-error-500, #ef4444)' }}>
          {errorMsg}
        </div>
      </div>
    )
  }

  if (chapters.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={sectionLabelStyle}>{s.courseLessons}</span>
        </div>
        <div style={stateMessageStyle}>{s.noLessons}</div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={sectionLabelStyle}>{s.courseLessons}</span>
      </div>

      {/* Type filter buttons */}
      <div style={filterBarStyle}>
        <button
          type="button"
          style={filterBtnStyle(activeFilter === 'all')}
          onClick={() => setActiveFilter('all')}
        >
          {s.filterAll}
        </button>
        <button
          type="button"
          style={filterBtnStyle(activeFilter === 'learning')}
          onClick={() => setActiveFilter('learning')}
        >
          <BookOpen size={12} />
          {s.learning}
        </button>
        <button
          type="button"
          style={filterBtnStyle(activeFilter === 'practice')}
          onClick={() => setActiveFilter('practice')}
        >
          <Pencil size={12} />
          {s.practice}
        </button>
        <button
          type="button"
          style={filterBtnStyle(activeFilter === 'exam')}
          onClick={() => setActiveFilter('exam')}
        >
          <ClipboardList size={12} />
          {s.exam}
        </button>
      </div>

      {chapters.map((group) => {
        const { chapter, lessons: allLessons } = group
        const lessons =
          activeFilter === 'all' ? allLessons : allLessons.filter((l) => l.type === activeFilter)

        return (
          <div key={chapter.id}>
            {/* Chapter header */}
            <div style={chapterHeaderStyle}>
              <span style={sectionLabelStyle}>{s.chapter}:</span>
              <a
                href={`/admin/collections/chapters/${chapter.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={chapterTitleLinkStyle}
                onClick={(e) => e.stopPropagation()}
              >
                {chapter.chapterLabel ? `${chapter.chapterLabel} — ` : ''}
                {chapter.title}
              </a>
              <span style={{ ...sectionLabelStyle, marginLeft: 'auto' }}>
                {lessons.length} {s.lesson}
                {lessons.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Lesson rows */}
            {lessons.map((lesson, idx) => {
              const isDragging = dragChapterId === chapter.id && dragLessonId === lesson.id
              const isDropTarget =
                dropTargetIdx?.chapterId === chapter.id && dropTargetIdx?.idx === idx

              return (
                <div
                  key={lesson.id}
                  draggable
                  onDragStart={() => handleDragStart(chapter.id, lesson.id)}
                  onDragOver={(e) => handleDragOver(e, chapter.id, idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, chapter.id, idx)}
                  onDragEnd={handleDragEnd}
                  style={lessonRowStyle(isDragging, isDropTarget, idx, lessons.length)}
                >
                  {/* Drag handle */}
                  <span style={{ color: 'var(--theme-elevation-300)', flexShrink: 0 }}>
                    <GripVertical size={16} />
                  </span>

                  {/* Index */}
                  <span style={lessonIndexStyle}>{idx + 1}</span>

                  {/* Type badge */}
                  <span style={typeBadgeStyle(lesson.type)}>
                    {lesson.type === 'learning' ? (
                      <BookOpen size={12} />
                    ) : lesson.type === 'practice' ? (
                      <Pencil size={12} />
                    ) : (
                      <ClipboardList size={12} />
                    )}
                    {lesson.type === 'learning'
                      ? s.learning
                      : lesson.type === 'practice'
                        ? s.practice
                        : s.exam}
                  </span>

                  {/* Title */}
                  <a
                    href={`/admin/collections/lessons/${lesson.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={lessonTitleLinkStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lesson.title}
                  </a>

                  {/* Chevron up */}
                  <button
                    type="button"
                    onClick={() => moveLesson(chapter.id, idx, idx - 1)}
                    disabled={idx === 0}
                    style={chevronBtnStyle(idx === 0)}
                    title={s.moveUp}
                  >
                    <ChevronUp size={14} />
                  </button>

                  {/* Chevron down */}
                  <button
                    type="button"
                    onClick={() => moveLesson(chapter.id, idx, idx + 1)}
                    disabled={idx === lessons.length - 1}
                    style={chevronBtnStyle(idx === lessons.length - 1)}
                    title={s.moveDown}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
