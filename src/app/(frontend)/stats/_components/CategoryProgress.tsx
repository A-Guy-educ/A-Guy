/**
 * Category Progress Component
 *
 * Displays progress by category with colored progress bars and left border accents.
 * Uses TAB_COLORS for per-category theming.
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { TAB_COLORS } from '@/app/(frontend)/courses/[courseSlug]/_components/CourseTabs'
import { GraduationCap, Pencil, FileText, MessageCircle } from 'lucide-react'

interface CategoryProgressData {
  learn: { count: number; total: number }
  practice: { attempted: number; completed: number; successRate: number }
  exams: { averageScore: number; practiced?: number }
  ask: { questionsAsked: number; conversations: number }
}

interface CategoryProgressProps {
  data: CategoryProgressData
}

export function CategoryProgress({ data }: CategoryProgressProps) {
  const t = useTranslations('stats')

  const categories = [
    {
      key: 'learn',
      icon: GraduationCap,
      color: TAB_COLORS.learn.text,
      title: t('categoryLearn'),
      value: `${data.learn.count}/${data.learn.total} ${t('lessonsCompleted')}`,
      progress: data.learn.total > 0 ? Math.round((data.learn.count / data.learn.total) * 100) : 0,
    },
    {
      key: 'practice',
      icon: Pencil,
      color: TAB_COLORS.practice.text,
      title: t('categoryPractice'),
      value: `${data.practice.completed}/${data.practice.attempted} (${data.practice.successRate}%) ${t('exercisesSuccessful')}`,
      progress: data.practice.successRate,
    },
    {
      key: 'exams',
      icon: FileText,
      color: TAB_COLORS.exams.text,
      title: t('categoryExams'),
      value: `${data.exams.practiced || 0} ${t('examsPracticed')}`,
      progress: data.exams.averageScore,
    },
    {
      key: 'ask',
      icon: MessageCircle,
      color: TAB_COLORS.ask.text,
      title: t('categoryAsk'),
      value: `${data.ask.questionsAsked} ${t('questionsAsked')}, ${data.ask.conversations} ${t('conversationsStarted')}`,
      progress: Math.min(Math.round((data.ask.questionsAsked / 20) * 100), 100),
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-content-gap">
      {categories.map((category) => {
        const Icon = category.icon
        return (
          <Card
            key={category.key}
            className="bg-card border shadow-elevation-1 rounded-xl p-card-padding hover:border-border/50 active:scale-[0.98] will-change-transform transition-all duration-normal"
            style={{ borderInlineStartWidth: '3px', borderInlineStartColor: category.color }}
          >
            <CardHeader className="pb-2">
              <CardTitle
                className="text-body-sm font-medium flex items-center gap-2"
                style={{ color: category.color }}
              >
                <Icon className="w-4 h-4" style={{ color: category.color }} />
                {category.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-heading-lg font-semibold">{category.value}</div>
              {/* Colored progress bar */}
              <div className="relative w-full overflow-hidden bg-muted rounded-full h-2 mt-3">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, category.progress))}%`,
                    backgroundColor: category.color,
                  }}
                />
              </div>
              <p className="text-body-xs text-muted-foreground mt-1.5">{category.progress}%</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
