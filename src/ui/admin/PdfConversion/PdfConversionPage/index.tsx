/**
 * PDF Conversion Page Layout
 *
 * @fileType component
 * @domain admin
 * @pattern admin-page-layout
 * @ai-summary Main two-column layout for PDF conversion page
 */
'use client'

import { useCallback, useState } from 'react'
import { ConversionForm } from '../ConversionForm'
import { ExerciseReview } from '../ExerciseReview'
import { JobHistory } from '../JobHistory'

export function PdfConversionPage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleConversionQueued = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">PDF Conversion</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        <div className="lg:sticky lg:top-4">
          <ConversionForm onQueued={handleConversionQueued} />
        </div>
        <div className="flex flex-col gap-4">
          <JobHistory
            refreshKey={refreshKey}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
          />
          {selectedJobId && <ExerciseReview jobId={selectedJobId} />}
        </div>
      </div>
    </div>
  )
}
