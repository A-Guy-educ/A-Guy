'use client'

import { useTranslation } from '@payloadcms/ui'
import { BookOpen, ClipboardList, FileText, GraduationCap, MessageSquare } from 'lucide-react'
import React from 'react'

import { MetricCard } from './MetricCard'
import { useMetricsContext } from './MetricsProvider'
import { getStrings } from './strings'
import {
  contentGridStyle,
  errorStyle,
  loadingStyle,
  widgetContainerStyle,
  widgetTitleStyle,
} from './styles'

const ContentCountsWidget: React.FC = () => {
  const { data, loading, error } = useMetricsContext()
  const { i18n } = useTranslation()
  const s = getStrings(i18n.language)

  if (error === 'admin-only') return null

  if (loading) {
    return (
      <div style={widgetContainerStyle}>
        <div style={loadingStyle}>{s.loading(s.contentOverview.toLowerCase())}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={widgetContainerStyle}>
        <div style={errorStyle}>
          {s.failedToLoad(s.contentOverview.toLowerCase())}: {error}
        </div>
      </div>
    )
  }

  const { contentCounts } = data

  return (
    <div style={widgetContainerStyle}>
      <h3 style={widgetTitleStyle}>{s.contentOverview}</h3>
      <div style={contentGridStyle}>
        <MetricCard
          label={s.courses}
          value={contentCounts.courses}
          icon={<GraduationCap size={18} />}
          iconColor="var(--theme-success)"
        />
        <MetricCard
          label={s.lessons}
          value={contentCounts.lessons}
          icon={<BookOpen size={18} />}
          iconColor="var(--theme-info)"
        />
        <MetricCard
          label={s.exercises}
          value={contentCounts.exercises}
          icon={<ClipboardList size={18} />}
          iconColor="var(--theme-warning)"
        />
        <MetricCard
          label={s.formulaSheets}
          value={contentCounts.formulaSheets}
          icon={<FileText size={18} />}
          iconColor="var(--theme-error)"
        />
        <MetricCard
          label={s.prompts}
          value={contentCounts.prompts}
          icon={<MessageSquare size={18} />}
          iconColor="var(--theme-elevation-700)"
        />
      </div>
    </div>
  )
}

export default ContentCountsWidget
