'use client'

import { useEffect, useState } from 'react'
import { getUserProfile } from '@/lib/localStorage/userProfile'
import { CourseCard } from '@/app/(frontend)/courses/_components/CourseCard'
import { useTranslations } from '@/providers/I18n'
import type { Course } from '@/payload-types'

export function StudyContent() {
  const t = useTranslations('study')
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const profile = getUserProfile()
      if (!profile?.gradeLevel) {
        window.location.href = '/'
        return
      }

      try {
        // Load courses
        const coursesResponse = await fetch('/api/courses')
        if (coursesResponse.ok) {
          const coursesData = await coursesResponse.json()
          setCourses(coursesData.docs || [])
        }
      } catch (error) {
        console.error('Failed to load courses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('chooseCourse')}</h1>
      {courses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-12">{t('noCoursesAvailable')}</div>
      )}
    </div>
  )
}
