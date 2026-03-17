/**
 * Activity Timeline Component
 *
 * Displays recent user activity chronologically
 */

'use client'

import { useEffect, useState } from 'react'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { CheckCircle2, FileQuestion, MessageCircle, HelpCircle, Activity } from 'lucide-react'

interface Activity {
  actionType: string
  label: string
  targetId: string
  targetCollection: string
  timestamp: string
}

function getActivityIcon(actionType: string) {
  switch (actionType) {
    case 'lesson_completed':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'exercise_attempted':
      return <FileQuestion className="w-4 h-4 text-blue-500" />
    case 'exercise_completed':
      return <CheckCircle2 className="w-4 h-4 text-green-600" />
    case 'question_asked':
      return <HelpCircle className="w-4 h-4 text-orange-500" />
    case 'conversation_started':
      return <MessageCircle className="w-4 h-4 text-purple-500" />
    default:
      return <Activity className="w-4 h-4 text-gray-500" />
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function ActivityTimeline() {
  const t = useTranslations('stats')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/stats/activity?limit=10', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          setActivities(data.activities || [])
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">{t('noActivity')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recentActivity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <div key={`${activity.targetId}-${index}`} className="flex items-start gap-3">
              {getActivityIcon(activity.actionType)}
              <div className="flex-1">
                <p className="text-sm font-medium">{activity.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
