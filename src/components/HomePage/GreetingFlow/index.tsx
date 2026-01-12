'use client'

import { useState, useEffect } from 'react'
import { TypingAnimation } from '@/components/shared/TypingAnimation'
import { Button } from '@/components/ui/button'
import { CourseCard } from '@/app/(frontend)/courses/_components/CourseCard'
import { setUserProfile } from '@/lib/localStorage/userProfile'
import { useTranslations } from '@/providers/I18n'
import type { Course } from '@/payload-types'

type FlowStep = 'greeting' | 'mood' | 'grade' | 'complete'

const MOODS = ['happy', 'neutral', 'sad', 'excited'] as const

export function GreetingFlow({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations('homepage.greeting')
  const tStudy = useTranslations('study')
  const [step, setStep] = useState<FlowStep>('greeting')
  const [selectedMood, setSelectedMood] = useState<string>('')
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)

  useEffect(() => {
    if (step === 'grade') {
      setIsLoadingCourses(true)
      async function loadCourses() {
        try {
          const coursesResponse = await fetch('/api/courses')
          if (coursesResponse.ok) {
            const coursesData = await coursesResponse.json()
            setCourses(coursesData.docs || [])
          }
        } catch (error) {
          console.error('Failed to load courses:', error)
        } finally {
          setIsLoadingCourses(false)
        }
      }
      loadCourses()
    }
  }, [step])

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood)
    setStep('grade')
  }

  const handleCourseSelect = (course: Course) => {
    // Extract grade from courseLabel (e.g., "8" or "ח"), or use a default
    const gradeLevel = course.courseLabel || '7'
    
    setUserProfile({
      gradeLevel,
      mood: selectedMood,
      lastVisit: new Date().toISOString(),
    })
    setStep('complete')
    setTimeout(() => onComplete(), 1000)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {step === 'greeting' && (
        <div className="max-w-2xl text-center">
          <TypingAnimation
            text={t('welcome')}
            speed={50}
            onComplete={() => setTimeout(() => setStep('mood'), 500)}
            className="text-2xl md:text-4xl mb-8"
          />
        </div>
      )}

      {step === 'mood' && (
        <div className="max-w-md w-full space-y-6">
          <h2 className="text-xl text-center">{t('moodQuestion')}</h2>
          <div className="grid grid-cols-2 gap-4">
            {MOODS.map((mood) => (
              <Button
                key={mood}
                variant="outline"
                size="lg"
                onClick={() => handleMoodSelect(mood)}
                className="h-20"
              >
                {t(`moods.${mood}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {step === 'grade' && (
        <div className="w-full max-w-7xl space-y-6">
          <h2 className="text-xl text-center">{t('gradeQuestion')}</h2>
          {isLoadingCourses ? (
            <div className="text-center text-muted-foreground py-12">{tStudy('loading')}</div>
          ) : courses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => handleCourseSelect(course)}
                  className="cursor-pointer"
                >
                  <CourseCard course={course} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">{tStudy('noCoursesAvailable')}</div>
          )}
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <TypingAnimation text={t('letsStart')} speed={50} className="text-2xl" />
        </div>
      )}
    </div>
  )
}
