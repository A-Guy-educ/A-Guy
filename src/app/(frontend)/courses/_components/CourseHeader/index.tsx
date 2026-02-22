import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'

interface CourseHeaderProps {
  courseLabel: string
  title: string
  descriptionHtml?: string | null
}

export function CourseHeader({ courseLabel, title, descriptionHtml }: CourseHeaderProps) {
  // Hide description if it's exactly the same as title (after trimming whitespace)
  const shouldShowDescription =
    descriptionHtml && descriptionHtml.trim() !== title.trim()

  return (
    <header className="mb-8">
      <div className="mb-2">
        <span className="text-sm font-semibold text-muted-foreground">{courseLabel}</span>
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && (
        <HtmlRenderer html={descriptionHtml} className="text-xl text-muted-foreground" />
      )}
    </header>
  )
}
