'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface DraftExercisesListProps {
  lessonId: string
  sourceDocId: string
}

interface Exercise {
  id: string
  title: string
  status: string
  origin: string
  sourcePageStart?: number
  sourcePageEnd?: number
  sourceOrderInSegment?: number
}

export function DraftExercisesList({ lessonId, sourceDocId }: DraftExercisesListProps) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function fetchExercises() {
      try {
        const where = encodeURIComponent(
          JSON.stringify({
            and: [
              { lesson: { equals: lessonId } },
              { sourceDoc: { equals: sourceDocId } },
              { origin: { equals: 'conversion' } },
              { status: { equals: 'draft' } },
            ],
          }),
        )

        const response = await fetch(
          `/api/exercises?where=${where}&limit=100&sort=sourceOrderInSegment`,
          { credentials: 'include' },
        )
        if (response.ok) {
          const data = await response.json()
          setExercises(data.docs || [])
        }
      } catch (err) {
        console.error('Failed to fetch exercises:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchExercises()
  }, [lessonId, sourceDocId])

  if (isLoading) {
    return <div className="draft-exercises-list loading">Loading exercises...</div>
  }

  if (exercises.length === 0) {
    return (
      <div className="draft-exercises-list empty">
        <p>No draft exercises found for this conversion.</p>
      </div>
    )
  }

  return (
    <div className="draft-exercises-list">
      <h3>Draft Exercises ({exercises.length})</h3>
      <ul>
        {exercises.map((exercise) => (
          <li key={exercise.id}>
            <button
              className="exercise-link"
              onClick={() => router.push(`/admin/collections/exercises/${exercise.id}`)}
            >
              {exercise.title}
              {exercise.sourcePageStart && exercise.sourcePageEnd && (
                <span className="page-range">
                  {' '}
                  (Pages {exercise.sourcePageStart}-{exercise.sourcePageEnd})
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
