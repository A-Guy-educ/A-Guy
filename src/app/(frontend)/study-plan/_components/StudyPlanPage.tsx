'use client'

import { cn } from '@/infra/utils/ui'
import { PageTransition } from '@/ui/web/components/page-transition'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Calendar, Plus, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { addExamDate, getExamDates, setExamDates } from '@/client/state/localStorage/examDates'
import type { MasteryLevel, TopicInput } from '@/server/services/study-plan'
import { Button } from '@/ui/web/components/button'
import { DayCard } from './DayCard'
import { EmptyPlanState } from './EmptyPlanState'
import { useStudyPlan } from './useStudyPlan'

const MASTERY_COLORS = {
  weak: 'bg-error/10 text-error border-error/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  strong: 'bg-success/10 text-success border-success/20',
}

interface TopicRowProps {
  topic: TopicInput
  onMasteryChange: (mastery: MasteryLevel) => void
  onDelete: () => void
}

function TopicRow({ topic, onMasteryChange, onDelete }: TopicRowProps) {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex items-center gap-2 p-3 bg-card rounded-lg border border-border transition-colors duration-normal">
      <div className="flex-1 min-w-0">
        <span className="text-body-sm font-medium text-foreground truncate block">
          {topic.topicLabel}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {(['weak', 'medium', 'strong'] as MasteryLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => onMasteryChange(level)}
            className={cn(
              'px-2 py-1 text-body-xs font-medium rounded-md border transition-colors duration-normal',
              topic.mastery === level
                ? MASTERY_COLORS[level]
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {t(`mastery.${level}`)}
          </button>
        ))}
        <button
          onClick={onDelete}
          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors duration-normal"
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
  const [topics, setTopics] = useState<TopicInput[]>([])
  const [newTopic, setNewTopic] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)

  // Load sidebar fields from saved plan and show schedule if plan was loaded from DB
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

    setTopics((prev) => [...prev, topic])
    setNewTopic('')
  }, [newTopic])

  const handleRemoveTopic = useCallback((topicId: string) => {
    pendingRegeneration.current = true
    setTopics((prev) => prev.filter((t) => t.topicId !== topicId))
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
    await generatePlan(examDate, topics, 'default-course')
    // Persist exam date to localStorage so the /study countdown can read it
    const existing = getExamDates('default-course')
    if (!existing.some((e) => e.date === examDate)) {
      addExamDate('default-course', { id: `exam-${Date.now()}`, date: examDate })
    } else {
      // Update: keep only the latest exam date
      setExamDates('default-course', [
        { id: existing[0]?.id ?? `exam-${Date.now()}`, date: examDate },
      ])
    }
    setHasGenerated(true)
  }, [examDate, topics, generatePlan])

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
    <PageTransition>
      <div className="min-h-screen bg-background py-section-sm px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-warning/10 rounded-xl mb-4">
              <Zap className="w-6 h-6 text-warning" />
            </div>
            <h1 className="text-heading-xl font-bold text-foreground mb-2">{t('pageTitle')}</h1>
            <p className="text-muted-foreground">{t('pageSubtitle')}</p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-content-gap">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-content-gap">
              {/* Exam Date Card */}
              <div className="bg-card rounded-2xl border border-border p-card-padding shadow-elevation-1">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-heading-lg font-semibold text-foreground">{t('examDate')}</h2>
                </div>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => {
                    pendingRegeneration.current = true
                    setExamDate(e.target.value)
                  }}
                  className="w-full px-4 py-2.5 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>

              {/* Topics Card */}
              <div className="bg-card rounded-2xl border border-border p-card-padding shadow-elevation-1">
                <h2 className="text-heading-lg font-semibold text-foreground mb-4">
                  {t('topicsTitle')}
                </h2>

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
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-foreground bg-card text-body-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                  <button
                    onClick={handleAddTopic}
                    className="p-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors duration-normal"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Generate Plan Button */}
              <Button
                onClick={handleGeneratePlan}
                disabled={!examDate || topics.length === 0 || isLoading}
                size="lg"
                className="w-full"
              >
                <Zap className="w-5 h-5 me-2" />
                {t('generateButton')}
              </Button>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              {isLoading && hasGenerated ? (
                <div className="flex flex-col items-center justify-center py-section-md px-4 border-2 border-dashed border-border rounded-2xl">
                  <div className="w-8 h-8 border-4 border-border border-t-foreground rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">{t('loading')}</p>
                </div>
              ) : hasGenerated && plan ? (
                <div>
                  <div className="mb-4">
                    <h2 className="text-heading-lg font-semibold text-foreground">
                      {t('scheduleTitle')}
                    </h2>
                    <p className="text-body-sm text-muted-foreground">{t('scheduleSubtitle')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-content-gap">
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
    </PageTransition>
  )
}
