'use client'

import Link from 'next/link'
import type { Chapter } from '@/payload-types'
import { useTranslations } from '@/providers/I18n'

interface ChapterCardProps {
  chapter: Chapter
  courseSlug: string
}

export function ChapterCard({ chapter, courseSlug }: ChapterCardProps) {
  const t = useTranslations('courses')

  if (!chapter.slug) {
    return null
  }

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {chapter.chapterLabel && (
              <span className="text-sm font-semibold text-gray-500">
                {t('chapter')} {chapter.chapterLabel}
              </span>
            )}
          </div>
          <h3 className="text-xl font-semibold mb-2">{chapter.title}</h3>
          {chapter.description && <p className="text-gray-600 mb-3">{chapter.description}</p>}
        </div>
      </div>
      <Link
        href={`/courses/${courseSlug}/chapters/${chapter.slug}`}
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
      >
        {t('viewChapter')}
      </Link>
    </div>
  )
}
