/**
 * Lesson Exercises Editor — Admin Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Displays all exercises of a lesson in a single scrollable view with inline editing.
 *
 * Access: Admins only
 */
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Pencil, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import { InlineExerciseEditor } from '@/ui/admin/LessonBlocksField/InlineExerciseEditor'
import { ExerciseRenderer } from '@/ui/web/exerciserenderer/ExerciseRenderer'
import type { ExerciseContentData } from '@/ui/web/exerciserenderer/types'
import { CardContent } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'

// ---- Types ----

interface LessonBlock {
  blockType: string
  id?: string
  exercise?: string | { id?: string }
}

interface LessonApiResponse {
  docs?: Array<{ id: string; title?: string; blocks?: string }>
  doc?: { id: string; title?: string; blocks?: string }
  title?: string
  blocks?: string
  id?: string
}

interface ExerciseApiResponse {
  doc?: {
    id: string
    title?: string
    content?: ExerciseContentData
    showQuestionNumbering?: boolean
  }
  title?: string
  content?: ExerciseContentData
  id?: string
  showQuestionNumbering?: boolean
}

interface DisplayExercise {
  id: string
  title: string
  content: ExerciseContentData
  showQuestionNumbering?: boolean
}

// ---- Styles ----

const pageStyle: React.CSSProperties = {
  padding: '24px',
  maxWidth: '800px',
  margin: '0 auto',
}

const loadingStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--theme-elevation-500)',
  fontSize: 14,
}

const errorStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--theme-error-500)',
  fontSize: 14,
}

const headerStyle: React.CSSProperties = {
  marginBottom: 24,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const exerciseCardStyle: React.CSSProperties = {
  marginBottom: 32,
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 8,
  overflow: 'hidden',
}

const exerciseHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: 'var(--theme-elevation-50)',
  borderBottom: '1px solid var(--theme-elevation-150)',
}

const exerciseTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--theme-text)',
  margin: 0,
}

const emptyStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--theme-elevation-500)',
  fontSize: 14,
}

const backButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-1000)',
  cursor: 'pointer',
  textDecoration: 'none',
  marginBottom: 16,
}

// ---- Helpers ----

function extractExerciseIdsFromBlocks(blocksJson: string): string[] {
  try {
    const blocks: LessonBlock[] = JSON.parse(blocksJson)
    return blocks
      .filter((b) => b.blockType === 'exerciseRef')
      .map((b) => {
        if (typeof b.exercise === 'string') return b.exercise || null
        if (b.exercise && typeof b.exercise === 'object' && 'id' in b.exercise) {
          const id = (b.exercise as { id?: unknown }).id
          if (id == null) return null
          return String(id)
        }
        return null
      })
      .filter((id): id is string => id !== null)
  } catch {
    return []
  }
}

// ---- Component ----

export default function LessonExercisesPage() {
  const params = useParams()
  const lessonId = params.id as string
  const { user, isLoading: userLoading } = useCurrentUser()

  const [lessonTitle, setLessonTitle] = useState<string>('')
  const [exerciseIds, setExerciseIds] = useState<string[]>([])
  const [exercises, setExercises] = useState<Record<string, DisplayExercise>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track which exercise is in edit mode
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)

  // Fetch lesson to get exercise IDs from blocks
  useEffect(() => {
    if (!lessonId) return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/lessons/${lessonId}?depth=1`, { credentials: 'include', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch lesson: ${res.status}`)
        return res.json()
      })
      .then((data: LessonApiResponse) => {
        const doc = data.doc || data
        setLessonTitle(doc?.title || 'Untitled Lesson')

        const blocksJson = doc?.blocks || '[]'
        const ids = extractExerciseIdsFromBlocks(blocksJson)
        setExerciseIds(ids)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })

    return () => controller.abort()
  }, [lessonId])

  // Fetch exercises in order
  useEffect(() => {
    if (exerciseIds.length === 0) {
      setLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchExercise = async (id: string): Promise<DisplayExercise | null> => {
      const res = await fetch(`/api/exercises/${id}?depth=0`, {
        credentials: 'include',
        signal: controller.signal,
      })
      if (!res.ok) return null
      const data: ExerciseApiResponse = await res.json()
      const doc = data.doc || data
      return {
        id: doc.id || id,
        title: doc.title || 'Untitled Exercise',
        content: doc.content || { blocks: [] },
        showQuestionNumbering: doc.showQuestionNumbering,
      }
    }

    const run = async () => {
      const results = await Promise.all(exerciseIds.map((id) => fetchExercise(id)))
      if (!cancelled) {
        const map: Record<string, DisplayExercise> = {}
        results.forEach((ex, i) => {
          if (ex) map[exerciseIds[i]] = ex
        })
        setExercises(map)
        setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [exerciseIds])

  const handleEdit = useCallback((id: string) => {
    setEditingExerciseId(id)
  }, [])

  const handleSave = useCallback((id: string) => {
    setEditingExerciseId(null)
    // Re-fetch the exercise to refresh the view after save
    fetch(`/api/exercises/${id}?depth=0`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ExerciseApiResponse | null) => {
        if (!data) return
        const doc = data.doc || data
        setExercises((prev) => ({
          ...prev,
          [id]: {
            id: doc.id || id,
            title: doc.title || 'Untitled Exercise',
            content: doc.content || { blocks: [] },
            showQuestionNumbering: doc.showQuestionNumbering,
          },
        }))
      })
      .catch(() => {
        // On error, just exit edit mode
        setEditingExerciseId(null)
      })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingExerciseId(null)
  }, [])

  if (userLoading) {
    return <div style={loadingStyle}>Loading…</div>
  }

  if (!user) {
    return <div style={errorStyle}>Please log in to access this page.</div>
  }

  const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'
  if (!isAdmin) {
    return <div style={errorStyle}>Admin access required.</div>
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>
          <Loader2
            size={20}
            style={{ margin: '0 auto 8px', display: 'block', animation: 'spin 1s linear infinite' }}
          />
          Loading exercises…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={errorStyle}>{error}</div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <ChevronRight size={18} style={{ color: 'var(--theme-elevation-500)', flexShrink: 0 }} />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>
          {lessonTitle}
        </h1>
      </div>

      {/* Exercise list */}
      {exerciseIds.length === 0 && <div style={emptyStyle}>No exercises in this lesson.</div>}

      {exerciseIds.map((exerciseId, index) => {
        const exercise = exercises[exerciseId]
        const isEditing = editingExerciseId === exerciseId

        return (
          <div key={exerciseId} style={exerciseCardStyle}>
            {/* Exercise card header */}
            <div style={exerciseHeaderStyle}>
              <h2 style={exerciseTitleStyle}>
                {index + 1}. {exercise?.title || 'Loading...'}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => (isEditing ? handleCancelEdit() : handleEdit(exerciseId))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {isEditing ? (
                  <>
                    <ChevronLeft size={14} />
                    Back to view
                  </>
                ) : (
                  <>
                    <Pencil size={14} />
                    Edit
                  </>
                )}
              </Button>
            </div>

            {/* Exercise content */}
            <CardContent style={{ padding: '16px' }}>
              {isEditing ? (
                <InlineExerciseEditor
                  exerciseId={exerciseId}
                  exerciseTitle={exercise?.title}
                  onSave={() => handleSave(exerciseId)}
                />
              ) : exercise ? (
                <ExerciseRenderer
                  content={exercise.content}
                  mode="student"
                  showCheckAnswer={false}
                  showExerciseNumber={exercise.showQuestionNumbering ?? false}
                  exerciseNumber={index + 1}
                  lessonId={lessonId}
                  exerciseId={exerciseId}
                />
              ) : (
                <div style={{ ...loadingStyle, padding: '16px' }}>
                  <Loader2
                    size={16}
                    style={{
                      margin: '0 auto',
                      display: 'block',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                </div>
              )}
            </CardContent>
          </div>
        )
      })}

      {/* Back link */}
      <a href={`/admin/collections/lessons/${lessonId}`} style={backButtonStyle}>
        Back to lesson
      </a>
    </div>
  )
}
