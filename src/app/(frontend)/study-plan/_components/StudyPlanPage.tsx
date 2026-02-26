'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Calendar, Plus, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { MasteryLevel, TopicInput } from '@/lib/study-plan'
import { DayCard } from './DayCard'
import { EmptyPlanState } from './EmptyPlanState'
import { useStudyPlan } from './useStudyPlan'

const MASTERY_COLORS = {
  weak: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  strong: 'bg-green-100 text-green-800 border-green-200',
}

interface TopicRowProps {
  topic: TopicInput
  onMasteryChange: (mastery: MasteryLevel) => void
  onDelete: () => void
}

function TopicRow({ topic, onMasteryChange, onDelete }: TopicRowProps) {
  const t = useTranslations('studyPlan')

  return (
    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-900 truncate block">
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
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t(`mastery.${level}`)}
          </button>
        ))}
        <button
          onClick={onDelete}
          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function StudyPlanPage() {
  const t = useTranslations('studyPlan')
  const { plan, isLoading, generatePlan, markDayComplete } = useStudyPlan()

  const userEdited = useRef(false)
  const [examDate, setExamDate] = useState('')
  const [topics, setTopics] = useState<TopicInput[]>([])
  const [newTopic, setNewTopic] = useState('')

  // Load initial state from plan
  useEffect(() => {
    if (plan) {
      setExamDate(plan.examDate)
      setTopics(plan.topics)
    }
  }, [plan])

  const handleAddTopic = useCallback(() => {
    if (!newTopic.trim()) return
    userEdited.current = true

    const topic: TopicInput = {
      topicId: `topic-${Date.now()}`,
      topicLabel: newTopic.trim(),
      mastery: 'weak',
    }

    setTopics((prev) => [...prev, topic])
    setNewTopic('')
  }, [newTopic])

  const handleRemoveTopic = useCallback((topicId: string) => {
    userEdited.current = true
    setTopics((prev) => prev.filter((t) => t.topicId !== topicId))
  }, [])

  const handleMasteryChange = useCallback((topicId: string, mastery: MasteryLevel) => {
    userEdited.current = true
    setTopics((prev) => prev.map((t) => (t.topicId === topicId ? { ...t, mastery } : t)))
  }, [])

  const handleMarkComplete = useCallback(
    async (dayId: string) => {
      await markDayComplete(dayId)
    },
    [markDayComplete],
  )

  // Auto-generate plan when user edits exam date or topics
  useEffect(() => {
    if (!userEdited.current) return
    if (examDate && topics.length > 0) {
      const timer = setTimeout(() => {
        userEdited.current = false
        generatePlan(examDate, topics, 'default-course')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [examDate, topics, generatePlan])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  const hasData = examDate && topics.length > 0

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-xl mb-4">
            <Zap className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('pageTitle')}</h1>
          <p className="text-slate-600">{t('pageSubtitle')}</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Exam Date Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">{t('examDate')}</h2>
              </div>
              <input
                type="date"
                value={examDate}
                onChange={(e) => {
                userEdited.current = true
                setExamDate(e.target.value)
              }}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              />
            </div>

            {/* Topics Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('topicsTitle')}</h2>

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
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
                <button
                  onClick={handleAddTopic}
                  className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            {hasData && plan ? (
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">{t('scheduleTitle')}</h2>
                  <p className="text-sm text-slate-600">{t('scheduleSubtitle')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {plan.days.map((day) => (
                    <DayCard
                      key={day.dayId}
                      day={day}
                      topics={topics}
                      onMarkComplete={() => handleMarkComplete(day.dayId)}
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
