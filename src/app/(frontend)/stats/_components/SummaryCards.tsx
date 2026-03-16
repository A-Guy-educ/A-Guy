/**
 * Summary Cards Component
 *
 * Four summary metric cards for the stats dashboard
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Flame, Clock, Target, TrendingUp } from 'lucide-react'

interface SummaryData {
  totalProgress: number
  timeSpent: number
  averageScore: number
  dailyStreak: number
}

interface CategoryProgress {
  learn: { count: number }
  practice: { attempted: number; completed: number; successRate: number }
  exams: { averageScore: number }
  ask: { questionsAsked: number; conversations: number }
}

interface SummaryCardsProps {
  summary: SummaryData
  categoryProgress: CategoryProgress
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function SummaryCards({ summary, categoryProgress }: SummaryCardsProps) {
  const t = useTranslations('stats')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="w-4 h-4" />
            {t('totalProgress')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{summary.totalProgress}%</div>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${summary.totalProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Time Spent */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('timeSpent')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatTime(summary.timeSpent)}</div>
          <div className="text-sm text-muted-foreground mt-2">
            {t('categoryLearn')}: {categoryProgress.learn.count} {t('lessonsCompleted')}
          </div>
        </CardContent>
      </Card>

      {/* Average Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {t('averageScore')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{summary.averageScore}%</div>
          <div className="text-sm text-muted-foreground mt-2">
            {t('categoryPractice')}: {categoryProgress.practice.successRate}%{' '}
            {t('exercisesSuccessful')}
          </div>
        </CardContent>
      </Card>

      {/* Daily Streak */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            {t('dailyStreak')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold flex items-center gap-2">
            {summary.dailyStreak}
            <span className="text-sm font-normal text-muted-foreground">{t('days')}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {t('categoryAsk')}: {categoryProgress.ask.conversations} {t('conversationsStarted')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
