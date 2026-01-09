'use client'

import { useTranslations } from '@/providers/I18n'

interface LessonHeaderProps {
  order: number
  title: string
  description?: string | null
}

export function LessonHeader({ order, title, description }: LessonHeaderProps) {
  const t = useTranslations('courses')

  return (
    <header className="mb-8">
      <div className="mb-2">
        <span className="text-sm font-semibold text-muted-foreground">
          {t('lesson')} {order}
        </span>
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {description && <p className="text-xl text-muted-foreground">{description}</p>}
    </header>
  )
}
