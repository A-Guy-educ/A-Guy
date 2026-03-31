'use client'

import { useState } from 'react'

import { cn } from '@/infra/utils/ui'
import type { StudyPlanDay, TopicInput } from '@/server/services/study-plan'
import { useTranslations } from '@/ui/web/providers/I18n'
import { CheckCircle2, Edit2 } from 'lucide-react'
import Link from 'next/link'

const ACTIVITY_COLORS = {
  practice: 'bg-primary/10 text-primary border-primary/20',
  hybrid: 'bg-accent/10 text-accent border-accent/20',
  full_simulation: 'bg-error/10 text-error border-error/20',
  reinforcement: 'bg-success/10 text-success border-success/20',
  warmup: 'bg-warning/10 text-warning border-warning/20',
} as const

interface DayCardProps {
  day: StudyPlanDay
  topics: TopicInput[]
  onToggleStatus: () => void
  onEdit?: (edits: { userTopicIds?: string[] }) => void
}

export function DayCard({ day, topics, onToggleStatus, onEdit }: DayCardProps) {
  const t = useTranslations('studyPlan')
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTopics, setSelectedTopics] = useState<string[]>(day.userTopicIds || day.topicIds)

  const isCompleted = day.status === 'completed'

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit({
        userTopicIds: selectedTopics,
      })
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setSelectedTopics(day.userTopicIds || day.topicIds)
    setIsEditing(false)
  }

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    )
  }

  if (isEditing) {
    return (
      <div className="rounded-2xl bg-card border border-border/40 border-s-4 border-s-primary shadow-elevation-1 overflow-hidden p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-body-sm font-semibold text-muted-foreground">
            {new Date(day.date).toLocaleDateString('he-IL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <span
            className={cn(
              'px-2.5 py-1 text-body-xs font-semibold rounded-full border',
              ACTIVITY_COLORS[day.activityType],
            )}
          >
            {t(`activity.${day.activityType}`)}
          </span>
        </div>

        {/* Topic selection */}
        <div className="mb-4">
          <label className="block text-body-xs font-medium text-muted-foreground mb-2">
            {t('topicsTitle')}
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {topics.map((topic) => (
              <button
                key={topic.topicId}
                type="button"
                onClick={() => toggleTopic(topic.topicId)}
                className={cn(
                  'px-2 py-0.5 text-body-xs font-medium rounded-md transition-colors duration-normal',
                  selectedTopics.includes(topic.topicId)
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {topic.topicLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            className="flex-1 px-4 py-2 text-body-sm font-medium text-background bg-foreground rounded-lg hover:bg-foreground/90 transition-colors duration-normal"
          >
            {t('saveEdit')}
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-4 py-2 text-body-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors duration-normal"
          >
            {t('cancelEdit')}
          </button>
        </div>
      </div>
    )
  }

  // Display mode
  return (
    <div
      className={cn(
        'relative rounded-2xl bg-card border border-border/40 shadow-elevation-1 p-5 transition-all duration-normal overflow-hidden',
        'border-s-4',
        isCompleted
          ? 'border-s-success opacity-60'
          : 'border-s-primary hover:shadow-card-hover hover:-translate-y-0.5',
      )}
    >
      {/* Edit button - only show when not completed */}
      {!isCompleted && onEdit && (
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-3 end-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors duration-normal"
          title={t('editDay')}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-body-sm font-semibold text-muted-foreground">
            {new Date(day.date).toLocaleDateString('he-IL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isCompleted && (
            <span className="flex items-center gap-1 text-success text-body-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {t('completed')}
            </span>
          )}
          <span
            className={cn(
              'px-2.5 py-1 text-body-xs font-semibold rounded-full border',
              ACTIVITY_COLORS[day.activityType],
            )}
          >
            {t(`activity.${day.activityType}`)}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {(day.userTopicIds || day.topicIds).map((id, idx) => {
            const topic = topics.find((t) => t.topicId === id)
            if (!topic) return null

            if (topic.lessonRef) {
              return (
                <Link
                  key={idx}
                  href={topic.lessonRef.lessonUrl}
                  className="px-2 py-0.5 text-body-xs font-medium bg-muted text-foreground rounded-md transition-all duration-normal hover:bg-primary/10 hover:text-primary"
                >
                  {topic.topicLabel}
                </Link>
              )
            }

            return (
              <span
                key={idx}
                className="px-2 py-0.5 text-body-xs font-medium bg-muted text-foreground rounded-md"
              >
                {topic.topicLabel}
              </span>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={onToggleStatus}
          className={cn(
            'px-4 py-2 text-body-sm font-medium rounded-lg transition-colors duration-normal',
            isCompleted
              ? 'text-muted-foreground bg-muted hover:bg-muted/80'
              : 'text-background bg-foreground hover:bg-foreground/90',
          )}
        >
          {isCompleted ? t('undoComplete') : t('markComplete')}
        </button>
      </div>
    </div>
  )
}
