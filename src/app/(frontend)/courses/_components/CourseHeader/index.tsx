'use client'

import { useTranslations } from '@/ui/web/providers/I18n'

interface CourseHeaderProps {
  courseLabel: string
  title: string
  description?: string | null
}

export function CourseHeader({ courseLabel, title, description }: CourseHeaderProps) {
  const t = useTranslations('courses')

  return (
    <header className="mb-8">
      {/* Main headline: Course name/label - centered */}
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-3">{courseLabel}</h1>

      {/* Sub-headline: "Study Program" - right-aligned (start in RTL) */}
      <h2 className="text-2xl md:text-3xl font-semibold text-start mb-6">{t('studyProgram')}</h2>

      {/* Course title - as h3 for proper document structure */}
      <h3 className="text-xl font-medium text-muted-foreground mb-2">{title}</h3>

      {/* Description - optional supporting text */}
      {description && <p className="text-lg text-muted-foreground">{description}</p>}
    </header>
  )
}
