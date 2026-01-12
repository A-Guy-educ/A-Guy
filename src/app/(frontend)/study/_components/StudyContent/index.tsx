'use client'

import { useEffect, useState } from 'react'
import { getUserProfile, getLocalProgress } from '@/lib/localStorage/userProfile'
import { TopicCard } from '@/components/HomePage/TopicCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/ui'
import { useTranslations } from '@/providers/I18n'
import type { Chapter, Course } from '@/payload-types'

export function StudyContent() {
  const t = useTranslations('study')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const [courseSlug, setCourseSlug] = useState<string>('')
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

        // Load chapters by grade
        const response = await fetch(`/api/chapters/by-grade?grade=${profile.gradeLevel}`)
        const data = await response.json()
        setChapters(data.chapters || [])
        setCourseSlug(data.courseSlug || '')

        const localProgress = getLocalProgress()
        const map: Record<string, number> = {}
        localProgress.forEach((record) => {
          if (record.recordType === 'chapter') {
            map[record.recordId] = record.completionPercentage
          }
        })
        setProgressMap(map)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleCourseClick = async (course: Course) => {
    if (course.slug && course.id) {
      setCourseSlug(course.slug)
      setIsLoading(true)
      try {
        // Load chapters for the selected course using Payload's standard API
        const response = await fetch(
          `/api/chapters?where[course][equals]=${course.id}&sort=order&depth=1`,
        )
        if (response.ok) {
          const data = await response.json()
          setChapters(data.docs || [])
        }
      } catch (error) {
        console.error('Failed to load chapters for course:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }

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
      {courses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {courses.map((course) => (
          <Card
            key={course.id}
            onClick={() => handleCourseClick(course)}
            className={cn(
              'cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
              courseSlug === course.slug && 'ring-2 ring-primary ring-offset-2',
            )}
          >
            <CardHeader>
              {course.courseLabel && (
                <Badge variant="secondary" className="w-fit mb-2 text-xs font-semibold">
                  {course.courseLabel}
                </Badge>
              )}
              <CardTitle className="text-lg font-bold">{course.title}</CardTitle>
            </CardHeader>
            {course.description && (
              <CardContent>
                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
              </CardContent>
            )}
          </Card>
          ))}
        </div>
      )}
      {courses.length === 0 && (
        <div className="text-center text-muted-foreground py-12">{t('noCoursesAvailable')}</div>
      )}

      {courseSlug && (
        <>
          <h2 className="text-2xl font-bold mb-6 mt-12">{t('studyTopics')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((chapter) => (
              <TopicCard
                key={chapter.id}
                chapter={chapter}
                progress={progressMap[chapter.id] || 0}
                courseSlug={courseSlug}
              />
            ))}
          </div>
          {chapters.length === 0 && (
            <div className="text-center text-muted-foreground py-12">{t('noTopicsAvailable')}</div>
          )}
        </>
      )}
    </div>
  )
}
