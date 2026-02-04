/**
 * Exercise Review Panel
 *
 * Slide-over panel for reviewing and managing exercises during conversion.
 *
 * @fileType component
 * @domain admin
 * @pattern slide-over-panel
 * @ai-summary Review panel for exercise approval/rejection/editing
 */

'use client'

import { useState } from 'react'

import { useExerciseReview } from '../hooks/useExerciseReview'

interface ExerciseReviewPanelProps {
  jobId: string
  exercise: {
    id: string
    index: number
    title: string
    content: Record<string, unknown>
    status: 'pending' | 'approved' | 'rejected' | 'edited' | 'skipped'
    scores?: {
      confidence: number
      completeness: number
      complexity: number
      duplicateLikelihood?: number
    }
    verificationResult?: {
      passed: boolean
      message: string
      issues?: string[]
    }
    adminNotes?: string
    enrichments?: Record<string, Record<string, unknown>>
  }
  isOpen: boolean
  onClose: () => void
  onAction: (action: 'approved' | 'rejected' | 'edited' | 'skipped') => void
}

export function ExerciseReviewPanel({
  jobId,
  exercise,
  isOpen,
  onClose,
  onAction,
}: ExerciseReviewPanelProps) {
  const { approveExercise, rejectExercise, editExercise, overrideVerification, isLoading, error } =
    useExerciseReview(jobId)

  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(exercise.title)
  const [editedContent, setEditedContent] = useState(JSON.stringify(exercise.content, null, 2))
  const [adminNotes, setAdminNotes] = useState(exercise.adminNotes || '')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const handleApprove = async () => {
    await approveExercise(exercise.index)
    onAction('approved')
    onClose()
  }

  const handleReject = async () => {
    await rejectExercise(exercise.index, rejectReason)
    onAction('rejected')
    onClose()
  }

  const handleSaveEdit = async () => {
    try {
      const content = JSON.parse(editedContent)
      await editExercise(exercise.index, {
        title: editedTitle,
        content,
        adminNotes,
      })
      onAction('edited')
      onClose()
    } catch (e) {
      console.error('Invalid JSON content', e)
    }
  }

  const handleOverride = async () => {
    await overrideVerification(exercise.index)
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreWidth = (score: number) => `${score * 100}%`

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Exercise Review</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">{error.message}</div>
          )}

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <p className="mt-1 text-lg font-medium">{exercise.title}</p>
            )}
          </div>

          {/* Quality Scores */}
          {exercise.scores && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Quality Scores</h3>
              <div className="space-y-2">
                {[
                  { label: 'Confidence', value: exercise.scores.confidence },
                  { label: 'Completeness', value: exercise.scores.completeness },
                  { label: 'Complexity', value: exercise.scores.complexity },
                ].map((score) => (
                  <div key={score.label} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-gray-600">{score.label}</span>
                    <div className="flex-1 rounded bg-gray-200">
                      <div
                        className={`h-2 rounded ${getScoreColor(score.value)}`}
                        style={{ width: getScoreWidth(score.value) }}
                      />
                    </div>
                    <span className="w-12 text-sm text-gray-600">
                      {Math.round(score.value * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Status */}
          {exercise.verificationResult && (
            <div className="mb-6 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                {exercise.verificationResult.passed ? (
                  <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    Verified
                  </span>
                ) : (
                  <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                    Verification Failed
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600">{exercise.verificationResult.message}</p>
              {exercise.verificationResult.issues &&
                exercise.verificationResult.issues.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-red-600">
                    {exercise.verificationResult.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              {!exercise.verificationResult.passed && (
                <button
                  onClick={handleOverride}
                  disabled={isLoading}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                >
                  Override Verification
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Content</label>
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={12}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-4 text-sm">
                {JSON.stringify(exercise.content, null, 2)}
              </pre>
            )}
          </div>

          {/* Enrichments */}
          {exercise.enrichments && Object.keys(exercise.enrichments).length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Enrichments</h3>
              {Object.entries(exercise.enrichments).map(([key, enrichment]) => (
                <div key={key} className="mb-3 rounded border p-3">
                  <h4 className="text-sm font-medium capitalize">{key}</h4>
                  <pre className="mt-1 overflow-x-auto text-xs">
                    {JSON.stringify(enrichment, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Admin Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Admin Notes</label>
            {isEditing ? (
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="Add notes about this exercise..."
              />
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                {exercise.adminNotes || <em className="text-gray-400">No notes</em>}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Edit
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowRejectDialog(true)}
              className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              disabled={isLoading}
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Approve'}
            </button>
          </div>
        </div>

        {/* Reject Dialog */}
        {showRejectDialog && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-medium">Reject Exercise</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={4}
                className="mb-4 block w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRejectDialog(false)}
                  className="rounded px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  disabled={isLoading || !rejectReason.trim()}
                >
                  {isLoading ? 'Processing...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
