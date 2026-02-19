'use client'

import { useState, useEffect } from 'react'
import { TypingAnimation } from '@/ui/web/shared/TypingAnimation'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Badge } from '@/ui/web/components/badge'
import { setUserProfile } from '@/client/state/localStorage/userProfile'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { Course } from '@/payload-types'

type FlowStep = 'greeting' | 'mood' | 'moodResponse' | 'courses' | 'complete'

const MOODS = ['excellent', 'great', 'tired'] as const

export function GreetingFlow({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations('homepage.greeting')
  const [step, setStep] = useState<FlowStep>('greeting')
  const [selectedMood, setSelectedMood] = useState<string>('')
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood)
    setStep('moodResponse')
  }

  useEffect(() => {
    if (step === 'courses') {
      setIsLoadingCourses(true)
      fetch(
        '/api/courses?where[status][equals]=published&where[isActive][equals]=true&sort=order&depth=2&limit=1000&pagination=false',
      )
        .then((res) => res.json())
        .then((data) => {
          setCourses(data.docs || [])
        })
        .catch((error) => {
          console.error('Failed to load courses:', error)
        })
        .finally(() => {
          setIsLoadingCourses(false)
        })
    }
  }, [step])

  const handleCourseSelect = (course: Course) => {
    // Extract grade level from courseLabel (e.g., "ח" -> "8", "י" -> "10")
    // If courseLabel is already a number, use it directly
    const gradeLevel = course.courseLabel || '8'

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
            speed={200}
            onComplete={() => setTimeout(() => setStep('mood'), 2000)}
            className="text-2xl md:text-4xl mb-8"
          />
        </div>
      )}

      {step === 'mood' && (
        <div className="max-w-md w-full space-y-6">
          <h2 className="text-xl text-center">{t('moodQuestion')}</h2>
          <div className="grid grid-cols-1 gap-4">
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

      {step === 'moodResponse' && (
        <div className="max-w-2xl text-center">
          <TypingAnimation
            text={t(`moodResponses.${selectedMood}`)}
            speed={200}
            onComplete={() => setTimeout(() => setStep('courses'), 1500)}
            className="text-2xl md:text-4xl mb-8"
          />
        </div>
      )}

      {step === 'courses' && (
        <div className="container mx-auto px-4 py-8 max-w-6xl w-full">
          <h2 className="text-xl text-center mb-8">{t('gradeQuestion')}</h2>
          {isLoadingCourses ? (
            <div className="text-center text-muted-foreground">{t('loading')}</div>
          ) : courses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <Card
                  key={course.id}
                  onClick={() => handleCourseSelect(course)}
                  className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full flex flex-col"
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
                    <CardContent className="flex-1">
                      <CardDescription className="line-clamp-2">
                        {course.description}
                      </CardDescription>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">{t('noCoursesAvailable')}</div>
          )}
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <TypingAnimation text={t('letsStart')} speed={100} className="text-2xl" />
        </div>
      )}
    </div>
  )
}
