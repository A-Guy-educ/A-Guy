'use client'

import { normalizeComparableText } from '@/infra/utils/normalizeComparableText'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ title, description }: ChapterHeaderProps) {
  const shouldShowDescription =
    description && normalizeComparableText(description) !== normalizeComparableText(title)

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && <p className="text-xl text-muted-foreground">{description}</p>}
    </div>
  )
}
