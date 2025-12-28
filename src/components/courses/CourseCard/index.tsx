'use client'

import Link from 'next/link'
import type { Course } from '@/payload-types'
import { useTranslations } from '@/providers/I18n'

interface CourseCardProps {
  course: Course
}

export function CourseCard({ course }: CourseCardProps) {
  const t = useTranslations('courses')

  if (!course.slug) {
    return null
  }

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="mb-2">
        <span className="text-sm font-semibold text-gray-600">{course.courseLabel}</span>
      </div>
      <h2 className="text-2xl font-bold mb-3">{course.title}</h2>
      {course.description && (
        <p className="text-gray-700 mb-4 line-clamp-3">{course.description}</p>
      )}
      <Link
        href={`/courses/${course.slug}`}
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
      >
        {t('openCourse')}
      </Link>
    </div>
  )
}
