/**
 * Exercise Review Component
 *
 * @fileType component
 * @domain admin
 * @pattern exercise-list
 * @ai-summary Displays exercises created by a conversion job with links to editor
 */
'use client'

import { useEffect, useState } from 'react'
import {
  cardStyle,
  exerciseCardStyle,
  exerciseMetaStyle,
  exerciseTitleStyle,
  getBadgeStyle,
  sectionHeadingStyle,
} from '../styles'

interface Exercise {
  id: string
  title: string
  sourcePages?: string
  _status?: 'draft' | 'published'
}

interface ExerciseReviewProps {
  jobId: string
}

const loadingStyle: React.CSSProperties = {
  ...cardStyle,
}

const errorStyle: React.CSSProperties = {
  ...cardStyle,
}

const emptyStyle: React.CSSProperties = {
  ...cardStyle,
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const exerciseContentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}

const openButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 13,
  backgroundColor: 'var(--theme-elevation-200)',
  color: 'var(--theme-elevation-800)',
  border: 'none',
  borderRadius: 3,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
}

export function ExerciseReview({ jobId }: ExerciseReviewProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchExercises() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/exercises?where[conversionJobId][equals]=${jobId}&limit=100&sort=sourceOrderInSegment`,
          { credentials: 'include' },
        )

        if (!response.ok) {
          throw new Error('Failed to fetch exercises')
        }

        const json = await response.json()
        const fetchedExercises: Exercise[] = json.data?.docs || json.docs || []
        setExercises(fetchedExercises)
      } catch (err) {
        console.error('Failed to fetch exercises:', err)
        setError('Failed to load exercises')
      } finally {
        setIsLoading(false)
      }
    }

    fetchExercises()
  }, [jobId])

  if (isLoading) {
    return (
      <div style={loadingStyle}>
        <h3 style={sectionHeadingStyle}>Exercises</h3>
        <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>
          Loading exercises...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={errorStyle}>
        <h3 style={sectionHeadingStyle}>Exercises</h3>
        <div style={{ fontSize: 13, color: 'var(--theme-error)' }}>{error}</div>
      </div>
    )
  }

  if (exercises.length === 0) {
    return (
      <div style={emptyStyle}>
        <h3 style={sectionHeadingStyle}>Exercises</h3>
        <div style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}>
          No exercises found for this job
        </div>
      </div>
    )
  }

  const truncateTitle = (title: string, maxLength = 80): string => {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength) + '...'
  }

  return (
    <div style={cardStyle}>
      <h3 style={sectionHeadingStyle}>Exercises ({exercises.length})</h3>
      <ul style={listStyle}>
        {exercises.map((exercise) => (
          <li key={exercise.id} style={exerciseCardStyle}>
            <div style={exerciseContentStyle}>
              <p style={exerciseTitleStyle}>{truncateTitle(exercise.title)}</p>
              {exercise.sourcePages && (
                <p style={exerciseMetaStyle}>Pages {exercise.sourcePages}</p>
              )}
              {exercise._status && (
                <span style={getBadgeStyle(exercise._status)}>{exercise._status}</span>
              )}
            </div>
            <a
              href={`/admin/collections/exercises/${exercise.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={openButtonStyle}
            >
              Open in Editor
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
