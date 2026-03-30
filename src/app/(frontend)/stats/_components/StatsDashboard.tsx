/**
 * Stats Dashboard Component
 *
 * Main client component for the statistics dashboard.
 * Uses a bento grid layout with staggered motion animations.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'

import { motion } from 'framer-motion'
import { PageTransition } from '@/ui/web/components/page-transition'
import { Skeleton, SkeletonCard, SkeletonText } from '@/ui/web/components/skeleton'
import { useTranslations } from '@/ui/web/providers/I18n'
import { SummaryCards } from './SummaryCards'
import { CategoryProgress } from './CategoryProgress'
import { PracticedItems } from './PracticedItems'
import { ActivityTimeline } from './ActivityTimeline'
import { DashboardFilters } from './DashboardFilters'

interface Course {
  id: string
  title: string
  slug: string
}

interface PracticedItem {
  lessonId: string
  title: string
  timeSpentSeconds: number
  chatQuestions: number
}

interface DashboardData {
  summary: {
    timeSpent: number
    dailyStreak: number
  }
  categoryProgress: {
    learn: { count: number; total: number }
    practice: { attempted: number; completed: number; successRate: number }
    exams: { averageScore: number; practiced?: number }
    ask: { questionsAsked: number; conversations: number }
  }
  practicedLessons: PracticedItem[]
  practicedExams: PracticedItem[]
}

interface StatsDashboardProps {
  initialCourseId: string
  initialTimeframe: 'week' | 'month' | 'overall'
  courses: Course[]
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (courseId !== 'all') {
        params.set('courseId', courseId)
      }
      params.set('timeframe', timeframe)

      const response = await fetch(`/api/stats/dashboard?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [courseId, timeframe])

  // Fetch on mount, filter change, and when user returns to this tab
  useEffect(() => {
    fetchData()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchData])

  return (
    <PageTransition>
      <div className="space-y-content-gap">
        <h1 className="text-display-sm font-bold">{t('title')}</h1>

        <DashboardFilters
          courses={courses}
          selectedCourseId={courseId}
          selectedTimeframe={timeframe}
          onCourseChange={setCourseId}
          onTimeframeChange={setTimeframe}
        />

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-content-gap">
            {/* Summary cards skeleton — full width */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border bg-card p-card-padding">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-content-gap">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category progress skeleton — full width */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border bg-card p-card-padding space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-content-gap">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-2 w-full rounded-full" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Practiced items skeleton — side by side */}
            <SkeletonCard />
            <SkeletonCard />

            {/* Activity timeline skeleton — full width */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border bg-card p-card-padding space-y-4">
                <Skeleton className="h-5 w-36" />
                <SkeletonText lines={5} />
              </div>
            </div>
          </div>
        ) : data ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-2 gap-content-gap"
          >
            {/* Summary Cards — spans full width for bento layout */}
            <motion.div variants={staggerItem} className="lg:col-span-2">
              <SummaryCards summary={data.summary} categoryProgress={data.categoryProgress} />
            </motion.div>

            {/* Category Progress — spans full width */}
            <motion.div variants={staggerItem} className="lg:col-span-2">
              <CategoryProgress data={data.categoryProgress} />
            </motion.div>

            {/* Practiced Items — side by side */}
            <motion.div variants={staggerItem}>
              <PracticedItems items={data.practicedLessons} type="lessons" />
            </motion.div>
            <motion.div variants={staggerItem}>
              <PracticedItems items={data.practicedExams} type="exams" />
            </motion.div>

            {/* Activity Timeline — spans full width */}
            <motion.div variants={staggerItem} className="lg:col-span-2">
              <ActivityTimeline />
            </motion.div>
          </motion.div>
        ) : (
          <div className="text-center py-section-lg text-muted-foreground">{t('errorLoading')}</div>
        )}
      </div>
    </PageTransition>
  )
}
