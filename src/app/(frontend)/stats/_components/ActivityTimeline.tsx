/**
 * Activity Timeline Component
 *
 * Displays recent user activity chronologically with a staggered
 * timeline layout and a connecting left border line.
 */

'use client'

import { useEffect, useState } from 'react'

import { motion } from 'framer-motion'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import {
  CheckCircle2,
  FileQuestion,
  MessageCircle,
  HelpCircle,
  Activity as ActivityIcon,
} from 'lucide-react'

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
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'exercise_attempted':
      return <FileQuestion className="w-4 h-4 text-primary" />
    case 'exercise_completed':
      return <CheckCircle2 className="w-4 h-4 text-success" />
    case 'question_asked':
      return <HelpCircle className="w-4 h-4 text-warning" />
    case 'conversation_started':
      return <MessageCircle className="w-4 h-4 text-accent-foreground" />
    default:
      return <ActivityIcon className="w-4 h-4 text-muted-foreground" />
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

const timelineItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  }),
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
      <Card className="bg-card border shadow-elevation-1 rounded-xl">
        <CardHeader>
          <CardTitle>{t('recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-section-md">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="bg-card border shadow-elevation-1 rounded-xl">
        <CardHeader>
          <CardTitle>{t('recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-section-sm">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <ActivityIcon className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-body-sm font-medium text-muted-foreground">{t('noActivity')}</p>
            <p className="text-body-xs text-muted-foreground/60 mt-1">{t('noActivitySub')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border shadow-elevation-1 rounded-xl hover:shadow-card-hover transition-all duration-normal">
      <CardHeader>
        <CardTitle>{t('recentActivity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Connecting vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-1">
            {activities.map((activity, index) => (
              <motion.div
                key={`${activity.targetId}-${index}`}
                custom={index}
                variants={timelineItemVariants}
                initial="hidden"
                animate="visible"
                className="relative flex items-start gap-3 py-2 pl-1"
              >
                {/* Icon sits on top of the vertical line */}
                <div className="relative z-10 flex-shrink-0 rounded-full bg-card p-0.5">
                  {getActivityIcon(activity.actionType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium">{activity.label}</p>
                  <p className="text-body-xs text-muted-foreground">
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
