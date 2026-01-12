'use client'

import { useEffect, useState } from 'react'
import { getUserProfile, getLocalProgress } from '@/lib/localStorage/userProfile'
import { TopicCard } from '@/components/HomePage/TopicCard'
import { CourseCardDropdown } from '@/components/HomePage/CourseCardDropdown'
import type { Chapter, Course } from '@/payload-types'

export function StudyContent() {
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
    if (course.slug) {
      setCourseSlug(course.slug)
      setIsLoading(true)
      try {
        // Load chapters for the selected course
        const response = await fetch(`/api/chapters/by-course?courseSlug=${course.slug}`)
        const data = await response.json()
        setChapters(data.chapters || [])
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
        <div className="text-center text-muted-foreground">טוען...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">בחר קורס</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        {courses.map((course) => (
          <CourseCardDropdown
            key={course.id}
            course={course}
            onClick={() => handleCourseClick(course)}
            className={courseSlug === course.slug ? 'ring-2 ring-primary ring-offset-2' : ''}
          />
        ))}
      </div>
      {courses.length === 0 && (
        <div className="text-center text-muted-foreground py-12">אין קורסים זמינים</div>
      )}

      {courseSlug && (
        <>
          <h2 className="text-2xl font-bold mb-6 mt-12">נושאי לימוד</h2>
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
            <div className="text-center text-muted-foreground py-12">
              אין נושאים זמינים בקורס זה
            </div>
          )}
        </>
      )}
    </div>
  )
}
