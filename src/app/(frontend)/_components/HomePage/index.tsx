'use client'

import { useState, useEffect } from 'react'
import { getUserProfile } from '@/lib/localStorage/userProfile'
import { GreetingFlow } from '@/components/HomePage/GreetingFlow'
import { CourseCard } from '@/app/(frontend)/courses/_components/CourseCard'
import { useTranslations } from '@/providers/I18n'
import type { Course } from '@/payload-types'

export function HomePage() {
  const t = useTranslations('study')
  const [showGreeting, setShowGreeting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [courses, setCourses] = useState<Course[]>([])

  const loadCourses = async () => {
    try {
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

  useEffect(() => {
    const profile = getUserProfile()
    if (!profile || !profile.gradeLevel) {
      setShowGreeting(true)
      setIsLoading(false)
      return
    }

    loadCourses()
  }, [])

  const handleGreetingComplete = () => {
    setShowGreeting(false)
    setIsLoading(true)
    loadCourses()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  if (showGreeting) {
    return <GreetingFlow onComplete={handleGreetingComplete} />
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <h1 className="text-3xl font-bold mb-8 text-center">{t('chooseCourse')}</h1>
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
    </div>
  )
}
