'use client'

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

import { errorStyle, loadingStyle, widgetContainerStyle, widgetTitleStyle } from './styles'
import { useMetrics } from './useMetrics'

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

const COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const EngagementWidget: React.FC = () => {
  const { data, loading, error } = useMetrics()

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <div style={loadingStyle}>Loading engagement data...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={widgetContainerStyle}>
        <div style={errorStyle}>Failed to load engagement data: {error}</div>
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
      <h3 style={widgetTitleStyle}>Engagement & Usage</h3>
      <div style={sectionStyle}>
        {/* Course Enrollment Distribution */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <GraduationCap size={16} color="#6366f1" />
            Course Enrollments
          </div>
          {engagement.courseEnrollments.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--theme-elevation-400)' }}>
              No enrollments yet
            </div>
          ) : (
            engagement.courseEnrollments.slice(0, 8).map((course, i) => (
              <div key={course.courseTitle} style={enrollmentRowStyle}>
                <div style={enrollmentLabelStyle}>
                  <span>{course.courseTitle}</span>
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
            ))
          )}
        </div>

        {/* Feature Usage */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <BarChart3 size={16} color="#3b82f6" />
            Feature Usage
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <Clock size={14} color="#10b981" />
              Avg time spent
            </span>
            <span style={statValueStyle}>{engagement.avgTimeSpentMinutes} min</span>
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <MessageCircle size={14} color="#6366f1" />
              Questions asked
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.questionsAsked.toLocaleString()}
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <Timer size={14} color="#8b5cf6" />
              Conversations
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.conversationsStarted.toLocaleString()}
            </span>
          </div>
          <div style={statRowStyle}>
            <span style={statLabelStyle}>
              <BookOpen size={14} color="#3b82f6" />
              Lessons completed
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.lessonsCompleted.toLocaleString()}
            </span>
          </div>
          <div style={{ ...statRowStyle, borderBottom: 'none' }}>
            <span style={statLabelStyle}>
              <PenTool size={14} color="#f59e0b" />
              Exercises completed
            </span>
            <span style={statValueStyle}>
              {engagement.featureUsage.exercisesCompleted.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Lesson Type Breakdown */}
        <div style={panelStyle}>
          <div style={panelTitleStyle}>
            <FlaskConical size={16} color="#10b981" />
            Content by Type
          </div>
          {[
            {
              label: 'Learning',
              count: engagement.lessonTypeUsage.learning,
              color: '#3b82f6',
              icon: <BookOpen size={14} color="#3b82f6" />,
            },
            {
              label: 'Practice',
              count: engagement.lessonTypeUsage.practice,
              color: '#f59e0b',
              icon: <PenTool size={14} color="#f59e0b" />,
            },
            {
              label: 'Exam',
              count: engagement.lessonTypeUsage.exam,
              color: '#ef4444',
              icon: <GraduationCap size={14} color="#ef4444" />,
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
