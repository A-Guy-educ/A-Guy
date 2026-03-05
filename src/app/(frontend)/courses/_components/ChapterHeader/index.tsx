'use client'

import { SafeHtml } from '@/ui/web/SafeHtml'
import { stripHtml } from '@/utils/strip-html'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ title, description }: ChapterHeaderProps) {
  // Hide description if it's exactly the same as title (after trimming whitespace)
  const plainDescription = description ? stripHtml(description) : ''
  const shouldShowDescription = plainDescription && plainDescription.trim() !== title.trim()

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && (
        <SafeHtml html={description!} className="text-xl text-muted-foreground [&_p]:m-0" />
      )}
    </div>
  )
}
