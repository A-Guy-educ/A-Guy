/**
 * Topic Mastery Component
 *
 * Displays topic/chapter success rates with drill-down capability
 */

'use client'

import { useState } from 'react'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'

interface TopicMasteryItem {
  chapterId: string
  chapterTitle: string
  successRate: number
}

interface TopicMasteryProps {
  topics: TopicMasteryItem[]
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 70) return 'text-green-600'
  if (rate >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export function TopicMastery({ topics }: TopicMasteryProps) {
  const t = useTranslations('stats')
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)

  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('topicMastery')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('noTopics')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('topicMastery')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {topics.map((topic) => (
          <div key={topic.chapterId}>
            <button
              onClick={() =>
                setExpandedTopic(expandedTopic === topic.chapterId ? null : topic.chapterId)
              }
              className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <span className="font-medium">{topic.chapterTitle}</span>
              <span className={`font-bold ${getSuccessRateColor(topic.successRate)}`}>
                {topic.successRate}%
              </span>
            </button>
            {expandedTopic === topic.chapterId && (
              <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground">
                  {topic.successRate >= 70
                    ? t('topicMastered')
                    : topic.successRate >= 40
                      ? t('topicImproving')
                      : t('topicNeedsWork')}
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
