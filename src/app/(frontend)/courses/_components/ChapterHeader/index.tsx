'use client'

interface ChapterHeaderProps {
  chapterLabel?: string | null
  title: string
  description?: string | null
}

export function ChapterHeader({ title, description }: ChapterHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {description && <p className="text-xl text-muted-foreground">{description}</p>}
    </div>
  )
}
