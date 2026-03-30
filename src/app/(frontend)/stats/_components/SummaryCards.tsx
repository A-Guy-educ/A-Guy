/**
 * Summary Cards Component
 *
 * Bento-style summary metric cards for the stats dashboard.
 * Primary metric (Time Spent) spans 2 columns with a gradient background.
 * Secondary metric (Daily Streak) is a standard single-column card.
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Flame, Clock } from 'lucide-react'
import { AnimatedCounter } from '@/ui/web/components/animated-counter'

interface SummaryData {
  timeSpent: number
  dailyStreak: number
}

interface CategoryProgress {
  learn: { count: number; total: number }
  practice: { attempted: number; completed: number; successRate: number }
  exams: { averageScore: number; practiced?: number }
  ask: { questionsAsked: number; conversations: number }
}

interface SummaryCardsProps {
  summary: SummaryData
  categoryProgress: CategoryProgress
}

function _formatTime(seconds: number): string {
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-content-gap">
      {/* Time Spent — Featured card spanning 2 columns */}
      <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 to-accent/5 border shadow-card rounded-xl p-card-padding hover:border-border/50 active:scale-[0.98] will-change-transform transition-all duration-normal">
        <CardHeader className="pb-2">
          <CardTitle className="text-body-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            {t('timeSpent')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-display-sm font-bold">
            {Math.floor(summary.timeSpent / 3600) > 0 && (
              <>
                <AnimatedCounter value={Math.floor(summary.timeSpent / 3600)} suffix="h" />{' '}
              </>
            )}
            <AnimatedCounter value={Math.floor((summary.timeSpent % 3600) / 60)} suffix="m" />
          </div>
          <div className="text-body-sm text-muted-foreground mt-2">
            {t('categoryLearn')}: {categoryProgress.learn.count} {t('lessonsCompleted')}
          </div>
        </CardContent>
      </Card>

      {/* Daily Streak — Standard card */}
      <Card
        className="bg-card border shadow-elevation-1 rounded-xl p-card-padding border-l-warning hover:border-border/50 active:scale-[0.98] will-change-transform transition-all duration-normal"
        style={{ borderInlineStartWidth: '3px' }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-body-sm font-medium text-muted-foreground flex items-center gap-2">
            <Flame className="w-5 h-5 text-warning" />
            {t('dailyStreak')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-display-sm font-bold flex items-center gap-2">
            <AnimatedCounter value={summary.dailyStreak} />
            <span className="text-body-sm font-normal text-muted-foreground">{t('days')}</span>
          </div>
          <div className="text-body-sm text-muted-foreground mt-2">
            {t('categoryAsk')}: {categoryProgress.ask.conversations} {t('conversationsStarted')}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
