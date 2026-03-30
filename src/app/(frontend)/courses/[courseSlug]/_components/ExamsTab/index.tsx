'use client'

import { CalendarPlus, Trash2 } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'
import { StaggerGrid, StaggerItem } from '@/ui/web/components/motion'
import { useExamCountdown } from '@/client/hooks/useExamCountdown'
import { AddExamDialog } from '../AddExamDialog'

interface ExamsTabProps {
  courseId: string
  accentColor?: string
}

export function ExamsTab({ courseId, accentColor }: ExamsTabProps) {
  const t = useTranslations('coursePage')
  const { upcomingExams, pastExams, addExam, removeExam } = useExamCountdown(courseId)

  const hasAnyExams = upcomingExams.length > 0 || pastExams.length > 0

  if (!hasAnyExams) {
    return (
      <div className="text-center py-20">
        <CalendarPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-body-lg font-bold text-foreground mb-1">{t('noExams')}</p>
        <p className="text-body-sm text-muted-foreground mb-6">{t('noExamsSub')}</p>
        <AddExamDialog onAdd={addExam} trigger={<Button>{t('addExam')}</Button>} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-heading-lg font-bold">{t('tabs.exams')}</h3>
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
        <StaggerGrid className="flex flex-col gap-3 max-w-3xl mx-auto">
          {upcomingExams.map((exam) => {
            const days = Math.ceil(
              (new Date(exam.date).getTime() - new Date().setHours(0, 0, 0, 0)) /
                (1000 * 60 * 60 * 24),
            )
            return (
              <StaggerItem key={exam.id}>
                <ExamCard
                  label={exam.label}
                  date={exam.date}
                  daysLeftText={t('daysLeft').replace('{days}', String(days))}
                  onDelete={() => removeExam(exam.id)}
                  deleteText={t('deleteExam')}
                  accentColor={accentColor}
                />
              </StaggerItem>
            )
          })}
        </StaggerGrid>
      )}

      {pastExams.length > 0 && (
        <div>
          <h4 className="text-body-sm font-bold text-muted-foreground mb-3">{t('pastExams')}</h4>
          <StaggerGrid className="flex flex-col gap-3 max-w-3xl mx-auto opacity-60">
            {pastExams.map((exam) => (
              <StaggerItem key={exam.id}>
                <ExamCard
                  label={exam.label}
                  date={exam.date}
                  isPast
                  onDelete={() => removeExam(exam.id)}
                  deleteText={t('deleteExam')}
                  accentColor={accentColor}
                />
              </StaggerItem>
            ))}
          </StaggerGrid>
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
  accentColor,
}: {
  label?: string
  date: string
  daysLeftText?: string
  isPast?: boolean
  onDelete: () => void
  deleteText: string
  accentColor?: string
}) {
  return (
    <div
      className="rounded-xl border border-border/30 transition-all duration-normal will-change-transform hover:border-border/50 active:scale-[0.98]"
      style={{ borderInlineStartWidth: '3px', borderInlineStartColor: accentColor ?? 'hsl(var(--primary))' }}
    >
      <div className="bg-card p-5 flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <div>
            {label && <p className="text-body-sm font-bold text-card-foreground">{label}</p>}
            <p className="text-body-xs text-muted-foreground">{date}</p>
          </div>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive p-1 transition-colors duration-normal"
          >
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">{deleteText}</span>
          </button>
        </div>
        {!isPast && daysLeftText && (
          <span
            className="text-body-xs font-bold"
            style={{ color: accentColor ?? 'hsl(var(--primary))' }}
          >
            {daysLeftText}
          </span>
        )}
      </div>
    </div>
  )
}
