'use client'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ title, description }: ChapterHeaderProps) {
  // Hide description if it's essentially the same as title (case/whitespace-insensitive)
  const shouldShowDescription =
    description && description.trim().toLowerCase() !== title.trim().toLowerCase()

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && <p className="text-xl text-muted-foreground">{description}</p>}
    </div>
  )
}
