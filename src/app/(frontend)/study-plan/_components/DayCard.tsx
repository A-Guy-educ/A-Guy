import type { StudyPlanDay, TopicInput } from '@/lib/study-plan'
import { useTranslations } from '@/ui/web/providers/I18n'
import { CheckCircle2, Clock } from 'lucide-react'

const ACTIVITY_COLORS = {
  practice: 'bg-blue-100 text-blue-800 border-blue-200',
  hybrid: 'bg-purple-100 text-purple-800 border-purple-200',
  full_simulation: 'bg-rose-100 text-rose-800 border-rose-200',
  reinforcement: 'bg-green-100 text-green-800 border-green-200',
  warmup: 'bg-amber-100 text-amber-800 border-amber-200',
} as const

interface DayCardProps {
  day: StudyPlanDay
  topics: TopicInput[]
  onMarkComplete: () => void
}

export function DayCard({ day, topics, onMarkComplete }: DayCardProps) {
  const t = useTranslations('studyPlan')

  const topicLabels = day.topicIds
    .map((id) => topics.find((t) => t.topicId === id)?.topicLabel)
    .filter(Boolean)

  const isCompleted = day.status === 'completed'

  return (
    <div
      className={`relative bg-white rounded-2xl border-2 p-5 transition-all ${
        isCompleted
          ? 'border-green-200 opacity-60'
          : 'border-slate-200 hover:border-slate-300 shadow-sm'
      }`}
    >
      {isCompleted && (
        <div className="absolute top-3 end-3 flex items-center gap-1 text-green-600">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{t('completed')}</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-slate-500">
            {new Date(day.date).toLocaleDateString('he-IL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
        <span
          className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
            ACTIVITY_COLORS[day.activityType]
          }`}
        >
          {t(`activity.${day.activityType}`)}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {topicLabels.map((label, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-md"
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-4 h-4" />
          <span className="text-sm">
            {day.estimatedDurationMinutes} {t('minutesShort')}
          </span>
        </div>

        {!isCompleted && (
          <button
            onClick={onMarkComplete}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {t('markComplete')}
          </button>
        )}
      </div>
    </div>
  )
}
