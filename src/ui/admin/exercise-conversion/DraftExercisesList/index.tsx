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
    return (
      <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 rounded">
        Loading exercises...
      </div>
    )
  }

  if (exercises.length === 0) {
    return (
      <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          No draft exercises found for this conversion.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded">
      <h3 className="text-sm font-medium mb-2">Draft Exercises ({exercises.length})</h3>
      <ul className="list-none p-0 m-0">
        {exercises.map((exercise) => (
          <li key={exercise.id} className="mb-1">
            <button
              className="w-full text-left px-0 py-1 bg-transparent border-none text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline"
              onClick={() => router.push(`/admin/collections/exercises/${exercise.id}`)}
            >
              {exercise.title}
              {exercise.sourcePageStart && exercise.sourcePageEnd && (
                <span className="text-zinc-400 dark:text-zinc-500 text-xs ml-1">
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
