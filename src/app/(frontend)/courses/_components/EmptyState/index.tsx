'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardContent } from '@/ui/web/components/card'
import { cn } from '@/infra/utils/ui'
import { BookOpen, Layers, FileText, AlertTriangle } from 'lucide-react'

type EmptyStateType = 'noCourses' | 'noChapters' | 'noLessons' | 'noPDF'

interface EmptyStateProps {
  type: EmptyStateType
}

const iconMap = {
  noCourses: BookOpen,
  noChapters: Layers,
  noLessons: FileText,
  noPDF: AlertTriangle,
} as const

export function EmptyState({ type }: EmptyStateProps) {
  const t = useTranslations('courses')
  const message = t(type)
  const Icon = iconMap[type]

  if (type === 'noPDF') {
    return (
      <Card className="bg-warning/10 border-warning/30 animate-fade-in">
        <CardContent className="p-card-padding text-center">
          <div className="flex flex-col items-center gap-content-gap-sm">
            <div className="w-12 h-12 rounded-2xl bg-warning/20 flex items-center justify-center">
              <Icon className="w-6 h-6 text-warning" />
            </div>
            <p className="text-body-md text-warning">{message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-section-md text-center animate-fade-in',
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-content-gap">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="text-body-lg text-muted-foreground">{message}</p>
    </div>
  )
}
