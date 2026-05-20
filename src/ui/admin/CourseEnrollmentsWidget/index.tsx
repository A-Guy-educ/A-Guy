/**
 * CourseEnrollmentsWidget — displays top 5 courses by enrollment count as a ranked list with progress bars.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Top courses ranked by enrollment count for the admin dashboard
 */

'use client'

import React, { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from '@payloadcms/ui'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { CHART_PALETTE } from '@/ui/admin/ConversionTracking/colors'
import { useMetricsContext } from '@/ui/admin/ConversionTracking/MetricsProvider'
import { getStrings } from '@/ui/admin/ConversionTracking/strings'
import {
  errorStyle,
  loadingStyle,
  widgetContainerStyle,
  widgetTitleStyle,
} from '@/ui/admin/ConversionTracking/styles'

const panelStyle: CSSProperties = {
  padding: 20,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
}

const enrollmentRowStyle: CSSProperties = {
  padding: '10px 0',
  borderBottom: '1px solid var(--theme-elevation-100)',
}

const enrollmentLabelStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-800)',
  marginBottom: 4,
  display: 'flex',
  justifyContent: 'space-between',
}

const barContainerStyle: CSSProperties = {
  height: 6,
  backgroundColor: 'var(--theme-elevation-100)',
  borderRadius: 3,
  overflow: 'hidden',
}

const viewAllButtonStyle: CSSProperties = {
  marginTop: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 16px',
  backgroundColor: 'transparent',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 6,
  color: 'var(--theme-elevation-700)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  width: '100%',
  transition: 'all 0.2s ease',
}

const CourseEnrollmentsWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)
  const [showAll, setShowAll] = useState(false)

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.topCourses}</h3>
        <div style={loadingStyle}>{s.loading(s.topCourses.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data?.engagement) {
    return (
      <div style={widgetContainerStyle}>
        <h3 style={widgetTitleStyle}>{s.topCourses}</h3>
        <div style={errorStyle}>
          {s.failedToLoad(s.topCourses.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { courseEnrollments } = data.engagement
  const maxCount = Math.max(...courseEnrollments.map((c) => c.count), 1)
  const displayCourses = showAll ? courseEnrollments : courseEnrollments.slice(0, 5)

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.topCourses}</h3>
      <div style={panelStyle}>
        {courseEnrollments.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--theme-elevation-400)' }}>{s.noEnrollments}</div>
        ) : (
          <>
            {displayCourses.map((course, i) => {
              const pct = (course.count / maxCount) * 100
              const color = CHART_PALETTE[i % CHART_PALETTE.length]
              const displayTitle = course.courseTitle.startsWith('__DELETED__:')
                ? `${s.deletedCourse} (${course.courseTitle.slice(12)})`
                : course.courseTitle

              return (
                <div key={course.courseTitle} style={enrollmentRowStyle}>
                  <div style={enrollmentLabelStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: 'var(--theme-elevation-600)',
                          width: 18,
                        }}
                      >
                        {i + 1}.
                      </span>
                      <span style={{ fontWeight: 500 }}>{displayTitle}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--theme-elevation-1000)' }}>
                      {course.count}
                    </span>
                  </div>
                  <div style={barContainerStyle}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: color,
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
            {courseEnrollments.length > 5 && (
              <button
                style={viewAllButtonStyle}
                onClick={() => setShowAll((prev) => !prev)}
                type="button"
              >
                {showAll ? (
                  <>
                    <ChevronUp size={14} />
                    {s.showLess}
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    {s.viewAll}
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CourseEnrollmentsWidget
