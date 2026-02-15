'use client'

/**
 * Normalizes text for comparison by trimming whitespace,
 * collapsing multiple spaces, and converting to lowercase.
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ title, description }: ChapterHeaderProps) {
  const shouldShowDescription = description && normalizeText(description) !== normalizeText(title)

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && <p className="text-xl text-muted-foreground">{description}</p>}
    </div>
  )
}
