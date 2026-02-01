'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ chapterLabel, title, description }: ChapterHeaderProps) {
  const t = useTranslations('courses')

  return (
    <div className="mb-8" data-chapter-header-version="v2-no-wrapper">
      {chapterLabel && (
        <span className="text-sm font-semibold text-muted-foreground mb-2 block">
          {t('chapter')} {chapterLabel}
        </span>
      )}
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {description && <p className="text-xl text-muted-foreground">{description}</p>}
    </div>
  )
}
