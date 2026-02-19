import RichText from '@/ui/web/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

interface CourseHeaderProps {
  courseLabel: string
  title: string
  description?: string | DefaultTypedEditorState | null
}

export function CourseHeader({ courseLabel, title, description }: CourseHeaderProps) {
  // Hide description if it's exactly the same as title (after trimming whitespace) - only for string descriptions
  const shouldShowDescription =
    description && (typeof description !== 'string' || description.trim() !== title.trim())

  return (
    <header className="mb-8">
      <div className="mb-2">
        <span className="text-sm font-semibold text-muted-foreground">{courseLabel}</span>
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {shouldShowDescription && typeof description === 'string' && (
        <p className="text-xl text-muted-foreground">{description}</p>
      )}
      {shouldShowDescription && typeof description !== 'string' && description && (
        <RichText data={description} enableProse={false} enableGutter={false} />
      )}
    </header>
  )
}
