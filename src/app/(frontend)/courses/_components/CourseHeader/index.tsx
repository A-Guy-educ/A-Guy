import { normalizeComparableText } from '@/infra/utils/normalizeComparableText'

interface CourseHeaderProps {
  courseLabel: string
  title: string
  description?: string | null
}

export function CourseHeader({ courseLabel, title, description }: CourseHeaderProps) {
  const shouldShowDescription =
    description && normalizeComparableText(description) !== normalizeComparableText(title)

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
