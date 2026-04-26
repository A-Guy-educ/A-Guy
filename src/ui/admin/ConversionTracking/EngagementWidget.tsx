'use client'

import { useTranslation } from '@payloadcms/ui'
import {
  BarChart3,
  BookOpen,
  Clock,
  FlaskConical,
  GraduationCap,
  MessageCircle,
  PenTool,
  Timer,
} from 'lucide-react'
import React from 'react'
import type { CSSProperties } from 'react'

import { ACCENT, CHART_PALETTE } from './colors'
import { useMetricsContext } from './MetricsProvider'
import { getStrings } from './strings'
import { errorStyle, loadingStyle, widgetContainerStyle, widgetTitleStyle } from './styles'

const sectionStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 20,
  marginBottom: 0,
}

const panelStyle: CSSProperties = {
  padding: 20,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
}

const panelTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--theme-elevation-800)',
  margin: '0 0 16px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const statRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid var(--theme-elevation-100)',
}

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-600)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const statValueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--theme-elevation-1000)',
}

const barContainerStyle: CSSProperties = {
  marginTop: 4,
  height: 6,
  backgroundColor: 'var(--theme-elevation-100)',
  borderRadius: 3,
  overflow: 'hidden',
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

const COLORS = CHART_PALETTE

const EngagementWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <div style={loadingStyle}>{s.loading(s.engagementAndUsage.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={widgetContainerStyle}>
        <div style={errorStyle}>
          {s.failedToLoad(s.engagementAndUsage.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { engagement } = data
  const maxEnrollment = Math.max(...engagement.courseEnrollments.map((c) => c.count), 1)
  const totalLessons =
    engagement.lessonTypeUsage.learning +
    engagement.lessonTypeUsage.practice +
    engagement.lessonTypeUsage.exam

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.engagementAndUsage}</h3>
      <div style={sectionStyle}>
        {/* Course Enrollment Distribution */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <GraduationCap size={16} color={ACCENT.indigo} />
            {s.courseEnrollments}
          </div>
          {engagement.courseEnrollments.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--theme-elevation-400)' }}>
              {s.noEnrollments}
            </div>
          ) : (
            engagement.courseEnrollments.slice(0, 8).map((course, i) => {
              const displayTitle = course.courseTitle.startsWith('__DELETED__:')
                ? `${s.deletedCourse} (${course.courseTitle.slice(12)})`
                : course.courseTitle
              return (
                <div key={course.courseTitle} style={enrollmentRowStyle}>
                  <div style={enrollmentLabelStyle}>
                    <span>{displayTitle}</span>
                    <span style={{ fontWeight: 600 }}>{course.count}</span>
                  </div>
                  <div style={barContainerStyle}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(course.count / maxEnrollment) * 100}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Feature Usage */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <BarChart3 size={16} color={ACCENT.blue} />
            {s.featureUsage}
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <Clock size={14} color={ACCENT.emerald} />
              {s.avgTimeSpent}
            </span>
            <span style={statValueStyle}>
              {engagement.avgTimeSpentMinutes} {s.minutes}
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <MessageCircle size={14} color={ACCENT.indigo} />
              {s.questionsAsked}
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.questionsAsked.toLocaleString()}
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <Timer size={14} color={ACCENT.violet} />
              {s.conversations}
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.conversationsStarted.toLocaleString()}
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <BookOpen size={14} color={ACCENT.blue} />
              {s.lessonsCompleted}
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.lessonsCompleted.toLocaleString()}
            </span>
          </div>
          <div style={{ ...statRowStyle, borderBottom: 'none' }}>
            <span style={statLabelStyle}>
              <PenTool size={14} color={ACCENT.amber} />
              {s.exercisesCompleted}
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.exercisesCompleted.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Lesson Type Breakdown */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <FlaskConical size={16} color={ACCENT.emerald} />
            {s.contentByType}
          </div>
          {[
            {
              label: s.typeLearning,
              count: engagement.lessonTypeUsage.learning,
              color: ACCENT.blue,
              icon: <BookOpen size={14} color={ACCENT.blue} />,
            },
            {
              label: s.typePractice,
              count: engagement.lessonTypeUsage.practice,
              color: ACCENT.amber,
              icon: <PenTool size={14} color={ACCENT.amber} />,
            },
            {
              label: s.typeExam,
              count: engagement.lessonTypeUsage.exam,
              color: ACCENT.red,
              icon: <GraduationCap size={14} color={ACCENT.red} />,
            },
          ].map((type) => (
            <div key={type.label} style={enrollmentRowStyle}>
              <div style={enrollmentLabelStyle}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {type.icon} {type.label}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {type.count}{' '}
                  <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.6 }}>
                    ({totalLessons > 0 ? ((type.count / totalLessons) * 100).toFixed(0) : 0}%)
                  </span>
                </span>
              </div>
              <div style={barContainerStyle}>
                <div
                  style={{
                    height: '100%',
                    width: totalLessons > 0 ? `${(type.count / totalLessons) * 100}%` : '0%',
                    backgroundColor: type.color,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EngagementWidget
