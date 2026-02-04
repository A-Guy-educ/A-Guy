/**
 * Exercise List Component
 *
 * List of exercises pending review with quick actions.
 *
 * @fileType component
 * @domain admin
 * @pattern list-view
 * @ai-summary List of exercises awaiting review
 */

'use client'

import type { ExerciseReviewState } from '../hooks/useExerciseReview'

interface ExerciseListProps {
  exercises: ExerciseReviewState[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  onAction: (index: number, action: 'approved' | 'rejected' | 'edited' | 'skipped') => void
}

export function ExerciseList({ exercises, selectedIndex, onSelect, onAction }: ExerciseListProps) {
  const pendingExercises = exercises.filter((ex) => ex.status === 'pending')

  if (pendingExercises.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        <p>No exercises pending review</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pendingExercises.map((exercise, idx) => (
        <div
          key={exercise.id}
          onClick={() => onSelect(idx)}
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            selectedIndex === idx
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium">{exercise.title}</h4>
              {exercise.scores && (
                <div className="mt-2 flex gap-4 text-sm">
                  <span className="text-gray-600">
                    Conf: {Math.round(exercise.scores.confidence * 100)}%
                  </span>
                  <span className="text-gray-600">
                    Complete: {Math.round(exercise.scores.completeness * 100)}%
                  </span>
                </div>
              )}
              {exercise.verificationResult && !exercise.verificationResult.passed && (
                <div className="mt-2">
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    Verification Failed
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAction(idx, 'approved')
                }}
                className="rounded bg-green-100 p-1.5 text-green-600 hover:bg-green-200"
                title="Approve"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAction(idx, 'rejected')
                }}
                className="rounded bg-red-100 p-1.5 text-red-600 hover:bg-red-200"
                title="Reject"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
