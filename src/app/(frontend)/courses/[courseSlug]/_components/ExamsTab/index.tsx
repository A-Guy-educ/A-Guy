'use client'

import { CalendarPlus, Trash2 } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import { AddExamDialog } from '../AddExamDialog'

interface ExamsTabProps {
  courseId: string
}

export function ExamsTab({ courseId }: ExamsTabProps) {
  const t = useTranslations('coursePage')
  const { upcomingExams, pastExams, addExam, removeExam } = useExamCountdown(courseId)

  const hasAnyExams = upcomingExams.length > 0 || pastExams.length > 0

  if (!hasAnyExams) {
    return (
      <div className="text-center py-20">
        <CalendarPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-lg font-bold text-foreground mb-1">{t('noExams')}</p>
        <p className="text-sm text-muted-foreground mb-6">{t('noExamsSub')}</p>
        <AddExamDialog onAdd={addExam} trigger={<Button>{t('addExam')}</Button>} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{t('tabs.exams')}</h3>
        <AddExamDialog
          onAdd={addExam}
          trigger={
            <Button variant="outline" size="sm">
              <CalendarPlus className="w-4 h-4 mr-1" />
              {t('addExam')}
            </Button>
          }
        />
      </div>

      {upcomingExams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingExams.map((exam) => {
            const days = Math.ceil(
              (new Date(exam.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                (1000 * 60 * 60 * 24),
            )
            return (
              <ExamCard
                key={exam.id}
                label={exam.label}
                date={exam.date}
                daysLeftText={t('daysLeft').replace('{days}', String(days))}
                onDelete={() => removeExam(exam.id)}
                deleteText={t('deleteExam')}
              />
            )
          })}
        </div>
      )}

      {pastExams.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-muted-foreground mb-3">{t('pastExams')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {pastExams.map((exam) => (
              <ExamCard
                key={exam.id}
                label={exam.label}
                date={exam.date}
                isPast
                onDelete={() => removeExam(exam.id)}
                deleteText={t('deleteExam')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExamCard({
  label,
  date,
  daysLeftText,
  isPast,
  onDelete,
  deleteText,
}: {
  label?: string
  date: string
  daysLeftText?: string
  isPast?: boolean
  onDelete: () => void
  deleteText: string
}) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-card border border-border flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          {label && <p className="text-sm font-bold text-card-foreground">{label}</p>}
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="w-4 h-4" />
          <span className="sr-only">{deleteText}</span>
        </button>
      </div>
      {!isPast && daysLeftText && (
        <span className="text-xs font-bold text-primary">{daysLeftText}</span>
      )}
    </div>
  )
}
