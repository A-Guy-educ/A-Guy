/**
 * Practiced Items Table Component
 *
 * Displays a compact table of practiced lessons or exams
 * Columns: Title | Time Spent | Chat Questions Count
 */

'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { GraduationCap, FileText, MessageCircle, Clock } from 'lucide-react'

interface PracticedItem {
  lessonId: string
  title: string
  timeSpentSeconds: number
  chatQuestions: number
}

interface PracticedItemsProps {
  items: PracticedItem[]
  type: 'lessons' | 'exams'
}

function formatTime(seconds: number): string {
  if (seconds === 0) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

export function PracticedItems({ items, type }: PracticedItemsProps) {
  const t = useTranslations('stats')

  const isExam = type === 'exams'
  const Icon = isExam ? FileText : GraduationCap
  const title = isExam ? t('practicedExams') : t('practicedLessons')
  const emptyMessage = isExam ? t('noExamsPracticed') : t('noLessonsPracticed')

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start py-2 font-medium text-muted-foreground">
                  {isExam ? t('examName') : t('lessonName')}
                </th>
                <th className="text-center py-2 font-medium text-muted-foreground whitespace-nowrap">
                  <span className="flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {t('timeSpent')}
                  </span>
                </th>
                <th className="text-center py-2 font-medium text-muted-foreground whitespace-nowrap">
                  <span className="flex items-center justify-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {t('chatQuestions')}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.lessonId} className="border-b border-border/50 last:border-b-0">
                  <td className="py-2.5 font-medium">{item.title}</td>
                  <td className="py-2.5 text-center text-muted-foreground">
                    {formatTime(item.timeSpentSeconds)}
                  </td>
                  <td className="py-2.5 text-center text-muted-foreground">
                    {item.chatQuestions > 0 ? item.chatQuestions : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
