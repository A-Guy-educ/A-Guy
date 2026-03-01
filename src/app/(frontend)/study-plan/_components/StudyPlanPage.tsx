'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Calendar, Plus, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { MasteryLevel, TopicInput } from '@/lib/study-plan'
import { addTopicWithLimit, MAX_TOPICS } from '@/lib/study-plan'
import { Button } from '@/ui/web/components/button'
import { DayCard } from './DayCard'
import { EmptyPlanState } from './EmptyPlanState'
import { ErrorCard } from './ErrorCard'
import { useStudyPlan } from './useStudyPlan'

const MASTERY_COLORS = {
  weak: 'bg-red-500/10 text-red-500 border-red-500/20',
  medium: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  strong: 'bg-green-500/10 text-green-500 border-green-500/20',
}

interface TopicRowProps {
  topic: TopicInput
  onMasteryChange: (mastery: MasteryLevel) => void
  onDelete: () => void
}

function TopicRow({ topic, onMasteryChange, onDelete }: TopicRowProps) {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex items-center gap-2 p-3 bg-card rounded-lg border border-border">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">
          {topic.topicLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {(['weak', 'medium', 'strong'] as MasteryLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => onMasteryChange(level)}
            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
              topic.mastery === level
                ? MASTERY_COLORS[level]
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {t(`mastery.${level}`)}
          </button>
        ))}
        <button
          onClick={onDelete}
          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function StudyPlanPage() {
  const t = useTranslations('studyPlan')
  const { plan, isLoading, generatePlan, toggleDayStatus, editDay } = useStudyPlan()

  const pendingRegeneration = useRef(false)
  const [examDate, setExamDate] = useState('')
  const [examDateError, setExamDateError] = useState<string | null>(null)
  const [topics, setTopics] = useState<TopicInput[]>([])
  const [newTopic, setNewTopic] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [topicError, setTopicError] = useState<string | null>(null)

  // Load initial state from plan
  useEffect(() => {
    if (plan) {
      setExamDate(plan.examDate)
      setTopics(plan.topics)
      setHasGenerated(true)
    }
  }, [plan])

  const handleAddTopic = useCallback(() => {
    if (!newTopic.trim()) return
    pendingRegeneration.current = true

    const topic: TopicInput = {
      topicId: `topic-${Date.now()}`,
      topicLabel: newTopic.trim(),
      mastery: 'weak',
    }

    const result = addTopicWithLimit(topics, topic)
    setTopics(result.topics)
    setTopicError(result.error)
    setNewTopic('')
  }, [newTopic, topics])

  const handleRemoveTopic = useCallback((topicId: string) => {
    pendingRegeneration.current = true
    setTopics((prev) => {
      const newTopics = prev.filter((t) => t.topicId !== topicId)
      // Clear error when topic count drops below limit
      if (newTopics.length < MAX_TOPICS) {
        setTopicError(null)
      }
      return newTopics
    })
  }, [])

  const handleMasteryChange = useCallback((topicId: string, mastery: MasteryLevel) => {
    pendingRegeneration.current = true
    setTopics((prev) => prev.map((t) => (t.topicId === topicId ? { ...t, mastery } : t)))
  }, [])

  const handleMarkComplete = useCallback(
    async (dayId: string) => {
      await toggleDayStatus(dayId)
    },
    [toggleDayStatus],
  )

  const handleGeneratePlan = useCallback(async () => {
    if (!examDate || topics.length === 0) return

    // Check if exam date is in the past
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const examDateObj = new Date(examDate)
    examDateObj.setHours(0, 0, 0, 0)

    if (examDateObj <= today) {
      setExamDateError(t('error.pastExamDate'))
      return
    }

    setExamDateError(null)
    await generatePlan(examDate, topics, 'default-course')
    setHasGenerated(true)
  }, [examDate, topics, generatePlan, t])

  // Auto-regenerate plan only after initial explicit generation
  useEffect(() => {
    if (!hasGenerated) return
    if (!pendingRegeneration.current) return
    if (examDate && topics.length > 0) {
      const timer = setTimeout(() => {
        pendingRegeneration.current = false
        generatePlan(examDate, topics, 'default-course')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [examDate, topics, generatePlan, hasGenerated])

  if (isLoading && !hasGenerated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/10 rounded-xl mb-4">
            <Zap className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('pageTitle')}</h1>
          <p className="text-muted-foreground">{t('pageSubtitle')}</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Exam Date Card */}
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">{t('examDate')}</h2>
              </div>
              <input
                type="date"
                value={examDate}
                onChange={(e) => {
                  pendingRegeneration.current = true
                  setExamDate(e.target.value)
                  setExamDateError(null)
                }}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              {examDateError && <p className="text-red-500 text-sm mt-2">{examDateError}</p>}
            </div>

            {/* Topics Card */}
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">{t('topicsTitle')}</h2>

              <div className="space-y-2 mb-4">
                {topics.map((topic) => (
                  <TopicRow
                    key={topic.topicId}
                    topic={topic}
                    onMasteryChange={(mastery) => handleMasteryChange(topic.topicId, mastery)}
                    onDelete={() => handleRemoveTopic(topic.topicId)}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                  placeholder={t('addTopicPlaceholder')}
                  disabled={topics.length >= MAX_TOPICS}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-foreground bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
                />
                <button
                  onClick={handleAddTopic}
                  disabled={topics.length >= MAX_TOPICS}
                  className="p-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {topicError && (
                <p className="text-red-500 text-sm mt-2">
                  {t(
                    `error.${topicError === 'Topic limit reached (max 10)' ? 'maxTopics' : topicError}`,
                  )}
                </p>
              )}
            </div>

            {/* Generate Plan Button */}
            {!hasGenerated && (
              <Button
                onClick={handleGeneratePlan}
                disabled={!examDate || topics.length === 0 || isLoading}
                size="lg"
                className="w-full"
              >
                <Zap className="w-5 h-5 me-2" />
                {t('generateButton')}
              </Button>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {isLoading && hasGenerated ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-2xl">
                <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">{t('loading')}</p>
              </div>
            ) : plan && plan.days.length === 0 ? (
              <ErrorCard message={t('error.pastExamDate')} />
            ) : plan ? (
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground">{t('scheduleTitle')}</h2>
                  <p className="text-sm text-muted-foreground">{t('scheduleSubtitle')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {plan.days.map((day) => (
                    <DayCard
                      key={day.dayId}
                      day={day}
                      topics={topics}
                      onToggleStatus={() => handleMarkComplete(day.dayId)}
                      onEdit={(edits) => editDay(day.dayId, edits)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyPlanState />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
