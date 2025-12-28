'use client'

import { useTranslations } from '@/providers/I18n'

interface LessonHeaderProps {
  order: number
  title: string
  description?: string | null
  contentType: 'none' | 'pdf'
}

export function LessonHeader({ order, title, description, contentType }: LessonHeaderProps) {
  const t = useTranslations('courses')

  return (
    <header className="mb-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-500">
          {t('lesson')} {order}
        </span>
        {contentType === 'pdf' && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {t('pdfBadge')}
          </span>
        )}
      </div>
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      {description && <p className="text-xl text-gray-700">{description}</p>}
    </header>
  )
}
