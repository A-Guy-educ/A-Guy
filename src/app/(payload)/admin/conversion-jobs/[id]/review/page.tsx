/**
 * Conversion Job Review Page
 *
 * Full-screen review mode for batch exercise approval.
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Full-screen review page for exercise batch approval
 */

'use client'

/* eslint-disable @typescript-eslint/no-explicit-any -- Payload polymorphic fields require any */

import { useState } from 'react'

import { ExerciseList } from '@/ui/admin/conversion-jobs/components/ExerciseList'
import { ExerciseReviewPanel } from '@/ui/admin/conversion-jobs/components/ExerciseReviewPanel'
import { useConversionJob } from '@/ui/admin/conversion-jobs/hooks/useConversionJob'
import { useConversionJobActions } from '@/ui/admin/conversion-jobs/hooks/useConversionJobActions'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function ConversionJobReviewPage() {
  const params = useParams()
  const jobId = params.id as string
  const { job, isLoading, error, refetch } = useConversionJob(jobId)
  const { approveAll } = useConversionJobActions()

  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-gray-600">Loading job...</p>
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600">Error Loading Job</h1>
          <p className="mt-2 text-gray-600">{error?.message || 'Job not found'}</p>
          <Link
            href="/admin/conversion-jobs"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            ← Back to Jobs
          </Link>
        </div>
      </div>
    )
  }

  const reviewStages = ['SEGMENT_REVIEW', 'VERIFICATION_REVIEW', 'FINAL_APPROVAL']
  const currentStage = job.progress?.currentStage || job.currentStage || ''
  const _isInReview = reviewStages.includes(currentStage)
  const pendingCount = (job.pendingExercises?.length || 0) as number

  const handleExerciseSelect = (index: number) => {
    setSelectedExerciseIndex(index)
    setIsPanelOpen(true)
  }

  const handleExerciseAction = (_action: 'approved' | 'rejected' | 'edited' | 'skipped') => {
    refetch()
  }

  const handleApproveAll = async () => {
    if (confirm(`Approve all ${pendingCount} exercises?`)) {
      await approveAll(job.id)
      refetch()
    }
  }

  const handleApproveStage = async () => {
    await fetch(`/api/conversion-jobs/${job.id}/approve-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    refetch()
  }

  const getExerciseAtIndex = (index: number) => {
    const exercises = (job.pendingExercises as any[]) || []
    return exercises[index] || null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/conversion-jobs/${job.id}`}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">{job.title}</h1>
                <p className="text-sm text-gray-500">
                  {currentStage} • {pendingCount} pending exercises
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <button
                  onClick={handleApproveAll}
                  className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Approve All ({pendingCount})
                </button>
              )}
              <button
                onClick={handleApproveStage}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Continue Processing
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Progress Summary */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="text-2xl font-semibold text-green-600">
              {(job.progress as any)?.approvedExercises || 0}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="text-2xl font-semibold text-red-600">
              {(job.progress as any)?.rejectedExercises || 0}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Exercises</p>
            <p className="text-2xl font-semibold text-blue-600">
              {(job.progress as any)?.totalExercises || 0}
            </p>
          </div>
        </div>

        {/* Exercise List */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-medium">Pending Exercises</h2>
          </div>
          <div className="p-6">
            <ExerciseList
              exercises={((job.pendingExercises as any[]) || []) as any}
              selectedIndex={selectedExerciseIndex}
              onSelect={handleExerciseSelect}
              onAction={(_idx, action) => handleExerciseAction(action)}
            />
          </div>
        </div>
      </main>

      {/* Review Panel */}
      {selectedExerciseIndex !== null && (
        <ExerciseReviewPanel
          jobId={job.id}
          exercise={getExerciseAtIndex(selectedExerciseIndex) as any}
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false)
            setSelectedExerciseIndex(null)
          }}
          onAction={handleExerciseAction}
        />
      )}
    </div>
  )
}
