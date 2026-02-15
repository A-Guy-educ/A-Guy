/**
 * Normalizes text for comparison by trimming whitespace,
 * collapsing multiple spaces, and converting to lowercase.
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

interface CourseHeaderProps {
  courseLabel: string
  title: string
  description?: string | null
}

export function CourseHeader({ courseLabel, title, description }: CourseHeaderProps) {
  const shouldShowDescription = description && normalizeText(description) !== normalizeText(title)

  return (
    <header className="mb-8">
      <div className="mb-2">
        <span className="text-sm font-semibold text-muted-foreground">{courseLabel}</span>
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && <p className="text-xl text-muted-foreground">{description}</p>}
    </header>
  )
}
