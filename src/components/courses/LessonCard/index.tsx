'use client'

import Link from 'next/link'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/providers/I18n'

interface LessonCardProps {
  lesson: Lesson
  courseSlug: string
}

export function LessonCard({ lesson, courseSlug }: LessonCardProps) {
  const t = useTranslations('courses')

  if (!lesson.slug) {
    return null
  }

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-semibold text-gray-500">
              {t('lesson')} {lesson.order}
            </span>
            {lesson.contentType === 'pdf' && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {t('pdfBadge')}
              </span>
            )}
          </div>
          <h3 className="text-xl font-semibold mb-2">{lesson.title}</h3>
          {lesson.description && <p className="text-gray-600 mb-3">{lesson.description}</p>}
        </div>
      </div>
      <Link
        href={`/courses/${courseSlug}/lessons/${lesson.slug}`}
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
      >
        {t('viewLesson')}
      </Link>
    </div>
  )
}
