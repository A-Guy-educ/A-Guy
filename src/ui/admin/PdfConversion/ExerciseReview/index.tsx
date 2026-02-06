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

interface Exercise {
  id: string
  title: string
  sourcePages?: string
  _status?: 'draft' | 'published'
}

interface ExerciseReviewProps {
  jobId: string
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
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Exercises</h3>
        <div className="text-sm text-gray-500">Loading exercises...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Exercises</h3>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Exercises</h3>
        <div className="text-sm text-gray-500">No exercises found for this job</div>
      </div>
    )
  }

  const truncateTitle = (title: string, maxLength = 80): string => {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength) + '...'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold mb-3">Exercises ({exercises.length})</h3>
      <ul className="space-y-2">
        {exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="p-3 border border-gray-200 rounded-lg hover:border-gray-300"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {truncateTitle(exercise.title)}
                </p>
                {exercise.sourcePages && (
                  <p className="text-xs text-gray-500">Pages {exercise.sourcePages}</p>
                )}
                {exercise._status && (
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                      exercise._status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {exercise._status}
                  </span>
                )}
              </div>
              <a
                href={`/admin/collections/exercises/${exercise.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors whitespace-nowrap"
              >
                Open in Editor
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
