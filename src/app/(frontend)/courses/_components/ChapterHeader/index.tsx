'use client'

import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  descriptionHtml?: string | null
}

export function ChapterHeader({ title, descriptionHtml }: ChapterHeaderProps) {
  // Hide description if it's exactly the same as title (after trimming whitespace)
  const shouldShowDescription = descriptionHtml && descriptionHtml.trim() !== title.trim()

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && (
        <HtmlRenderer html={descriptionHtml} className="text-xl text-muted-foreground" />
      )}
    </div>
  )
}
