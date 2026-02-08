/**
 * PDF Conversion Page Layout
 *
 * @fileType component
 * @domain admin
 * @pattern admin-page-layout
 * @ai-summary Main two-column layout for PDF conversion page
 */
'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { ConversionForm } from '../ConversionForm'
import { ExerciseReview } from '../ExerciseReview'
import { JobHistory } from '../JobHistory'

const pageStyle: React.CSSProperties = {
  padding: 'calc(var(--base) * 1.5)',
  maxWidth: 1400,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'calc(var(--base) * 0.75)',
  marginBottom: 'calc(var(--base) * 1.25)',
  paddingBottom: 'calc(var(--base) * 1.25)',
  borderBottom: '1px solid var(--theme-elevation-150)',
}

const backLinkStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-500)',
  textDecoration: 'none',
  fontSize: 13,
}

const headerSepStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-300)',
  fontSize: 14,
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: 'var(--theme-text)',
  margin: 0,
}

const layoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '400px 1fr',
  gap: 'calc(var(--base) * 1.5)',
  alignItems: 'start',
}

const leftStyle: React.CSSProperties = {
  position: 'sticky',
  top: 'calc(var(--base) * 1.5)',
}

const rightStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'calc(var(--base) * 1.5)',
  minWidth: 0,
}

export function PdfConversionPage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleConversionQueued = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <Link href="/admin" style={backLinkStyle}>
          Dashboard
        </Link>
        <span style={headerSepStyle}>/</span>
        <h1 style={titleStyle}>PDF Conversion</h1>
      </div>
      <div style={layoutStyle}>
        <div style={leftStyle}>
          <ConversionForm onQueued={handleConversionQueued} />
        </div>
        <div style={rightStyle}>
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
