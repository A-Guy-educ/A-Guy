'use client'

import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ title, description }: ChapterHeaderProps) {
  // Hide description if it's exactly the same as title (after trimming whitespace)
  const shouldShowDescription = description && description.trim() !== title.trim()

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && (
        <div className="text-xl text-muted-foreground">
          <HtmlRenderer html={description} />
        </div>
      )}
    </div>
  )
}
