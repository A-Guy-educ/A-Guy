'use client'

import { useState } from 'react'

import type { MasteryLevel, StudyPlanDay, TopicInput } from '@/lib/study-plan'
import { useTranslations } from '@/ui/web/providers/I18n'
import { CheckCircle2, Clock, Edit2 } from 'lucide-react'

const ACTIVITY_COLORS = {
  practice: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  hybrid: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  full_simulation: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  reinforcement: 'bg-green-500/10 text-green-500 border-green-500/20',
  warmup: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
} as const

const MASTERY_COLORS: Record<MasteryLevel, string> = {
  weak: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  strong: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
}

interface DayCardProps {
  day: StudyPlanDay
  topics: TopicInput[]
  onToggleStatus: () => void
  onEdit?: (edits: {
    userTopicIds?: string[]
    userDurationMinutes?: number
    userStartTime?: string
  }) => void
}

export function DayCard({ day, topics, onToggleStatus, onEdit }: DayCardProps) {
  const t = useTranslations('studyPlan')
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTopics, setSelectedTopics] = useState<string[]>(day.userTopicIds || day.topicIds)
  const [duration, setDuration] = useState(day.userDurationMinutes || day.estimatedDurationMinutes)
  const [startTime, setStartTime] = useState(day.userStartTime || '')

  const isCompleted = day.status === 'completed'

  const handleSaveEdit = () => {
    if (onEdit) {
      onEdit({
        userTopicIds: selectedTopics,
        userDurationMinutes: duration,
        userStartTime: startTime || undefined,
      })
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    // Reset to current values
    setSelectedTopics(day.userTopicIds || day.topicIds)
    setDuration(day.userDurationMinutes || day.estimatedDurationMinutes)
    setStartTime(day.userStartTime || '')
    setIsEditing(false)
  }

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    )
  }

  if (isEditing) {
    return (
      <div className="bg-card rounded-2xl border-2 border-primary/50 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <span className="text-sm font-semibold text-muted-foreground">
            {new Date(day.date).toLocaleDateString('he-IL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
              ACTIVITY_COLORS[day.activityType]
            }`}
          >
            {t(`activity.${day.activityType}`)}
          </span>
        </div>

        {/* Topic selection */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            {t('topicsTitle')}
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {topics.map((topic) => (
              <button
                key={topic.topicId}
                type="button"
                onClick={() => toggleTopic(topic.topicId)}
                className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                  selectedTopics.includes(topic.topicId)
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {topic.topicLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Duration input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            {t('durationLabel')}
          </label>
          <input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Start time input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            {t('startTimeLabel')}
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            className="flex-1 px-4 py-2 text-sm font-medium text-background bg-foreground rounded-lg hover:bg-foreground/90 transition-colors"
          >
            {t('saveEdit')}
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
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
      className={`relative bg-card rounded-2xl border-2 p-5 transition-all ${
        isCompleted
          ? 'border-emerald-500/30 opacity-50'
          : 'border-border hover:border-border shadow-sm'
      }`}
    >
      {/* Edit button - only show when not completed */}
      {!isCompleted && onEdit && (
        <button
          onClick={() => setIsEditing(true)}
          className="absolute top-3 end-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title={t('editDay')}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-muted-foreground">
            {new Date(day.date).toLocaleDateString('he-IL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
          {/* Show user override start time if set */}
          {day.userStartTime && (
            <span className="text-xs text-muted-foreground ms-2">{day.userStartTime}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isCompleted && (
            <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4" />
              {t('completed')}
            </span>
          )}
          <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
              ACTIVITY_COLORS[day.activityType]
            }`}
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
            return (
              <span
                key={idx}
                className={`px-2 py-0.5 text-xs font-medium rounded-md border ${MASTERY_COLORS[topic.mastery]}`}
              >
                {topic.topicLabel}
              </span>
            )
          })}
        </div>
      </div>

      {/* Tasks */}
      {day.tasks && day.tasks.length > 0 && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <ul className="space-y-1">
            {day.tasks.map((task, idx) => (
              <li key={idx} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{task.label}:</span>{' '}
                {task.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-sm">
            {day.userDurationMinutes || day.estimatedDurationMinutes} {t('minutesShort')}
          </span>
        </div>

        <button
          onClick={onToggleStatus}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            isCompleted
              ? 'text-muted-foreground bg-muted hover:bg-muted/80'
              : 'text-background bg-foreground hover:bg-foreground/90'
          }`}
        >
          {isCompleted ? t('undoComplete') : t('markComplete')}
        </button>
      </div>
    </div>
  )
}
