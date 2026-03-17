/**
 * Stats Dashboard Component
 *
 * Main client component for the statistics dashboard
 */

'use client'

import { useEffect, useState } from 'react'

import { useTranslations } from '@/ui/web/providers/I18n'
import { SummaryCards } from './SummaryCards'
import { CategoryProgress } from './CategoryProgress'
import { TopicMastery } from './TopicMastery'
import { ActivityTimeline } from './ActivityTimeline'
import { DashboardFilters } from './DashboardFilters'

interface Course {
  id: string
  title: string
  slug: string
}

interface DashboardData {
  summary: {
    totalProgress: number
    timeSpent: number
    averageScore: number
    dailyStreak: number
  }
  categoryProgress: {
    learn: { count: number; total: number }
    practice: { attempted: number; completed: number; successRate: number }
    exams: { averageScore: number }
    ask: { questionsAsked: number; conversations: number }
  }
  topicMastery: Array<{
    chapterId: string
    chapterTitle: string
    successRate: number
  }>
}

interface StatsDashboardProps {
  initialCourseId: string
  initialTimeframe: 'week' | 'month' | 'overall'
  courses: Course[]
}

export function StatsDashboard({
  initialCourseId,
  initialTimeframe,
  courses,
}: StatsDashboardProps) {
  const t = useTranslations('stats')
  const [courseId, setCourseId] = useState(initialCourseId)
  const [timeframe, setTimeframe] = useState(initialTimeframe)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (courseId !== 'all') {
          params.set('courseId', courseId)
        }
        params.set('timeframe', timeframe)

        const response = await fetch(`/api/stats/dashboard?${params.toString()}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [courseId, timeframe])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('title')}</h1>

      <DashboardFilters
        courses={courses}
        selectedCourseId={courseId}
        selectedTimeframe={timeframe}
        onCourseChange={setCourseId}
        onTimeframeChange={setTimeframe}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : data ? (
        <>
          <SummaryCards summary={data.summary} categoryProgress={data.categoryProgress} />
          <CategoryProgress data={data.categoryProgress} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopicMastery topics={data.topicMastery} />
            <ActivityTimeline />
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t('errorLoading')}</div>
      )}
    </div>
  )
}
