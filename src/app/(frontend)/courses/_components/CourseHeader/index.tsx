interface CourseHeaderProps {
  courseLabel: string
  title: string
  description?: string | null
}

export function CourseHeader({ courseLabel, title, description }: CourseHeaderProps) {
  // Hide description if it's exactly the same as title (after trimming whitespace)
  const shouldShowDescription = description && description.trim() !== title.trim()

  return (
    <header className="mb-8">
      <div className="mb-2">
        <span className="text-body-sm font-semibold text-muted-foreground">{courseLabel}</span>
      </div>
      <h1 className="text-display-md font-bold mb-4">{title}</h1>
      {shouldShowDescription && <p className="text-body-xl text-muted-foreground">{description}</p>}
    </header>
  )
}
