'use client'

import { useState, useEffect } from 'react'
import { TypingAnimation } from '@/ui/web/shared/TypingAnimation'
import { Button } from '@/ui/web/components/button'
import { AccentCard } from '@/ui/web/components/accent-card'
import { Stack } from '@/ui/web/shared/Layout/Stack'
import { Grid } from '@/ui/web/shared/Layout/Grid'
import { Section } from '@/ui/web/shared/Layout/Section'
import { Text } from '@/ui/web/shared/Typography/Text'
import { setUserProfile } from '@/client/state/localStorage/userProfile'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { Course } from '@/payload-types'

const COURSE_COLORS = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(271 91% 65%)',
  'hsl(25 95% 53%)',
  'hsl(330 81% 60%)',
]

function getCourseColor(label?: string | null): string {
  if (!label) return COURSE_COLORS[0]
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length]
}

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
    const controller = new AbortController()

    if (step === 'courses') {
      setIsLoadingCourses(true)
      fetch(
        '/api/courses?where[status][equals]=published&where[isActive][equals]=true&sort=order&depth=2&limit=1000&pagination=false',
        { signal: controller.signal },
      )
        .then((res) => res.json())
        .then((data) => {
          setCourses(data.docs || [])
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Failed to load courses:', error)
          }
        })
        .finally(() => {
          setIsLoadingCourses(false)
        })
    }

    return () => {
      controller.abort()
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
    <Section size="lg" className="min-h-screen flex items-center justify-center">
      {step === 'greeting' && (
        <Stack gap="content-gap-lg" align="center" className="text-center">
          <TypingAnimation
            text={t('welcome')}
            speed={100}
            onComplete={() => setTimeout(() => setStep('mood'), 2000)}
            className="text-display-sm md:text-display-md"
          />
        </Stack>
      )}

      {step === 'mood' && (
        <Stack gap="content-gap-lg" align="center" className="w-full max-w-md">
          <h2 className="text-heading-xl text-center">{t('moodQuestion')}</h2>
          <Grid cols="1" gap="content-gap">
            {MOODS.map((mood) => (
              <Button
                key={mood}
                variant="outline"
                size="lg"
                onClick={() => handleMoodSelect(mood)}
                className="h-input-h-lg"
              >
                {t(`moods.${mood}`)}
              </Button>
            ))}
          </Grid>
        </Stack>
      )}

      {step === 'moodResponse' && (
        <Stack gap="content-gap-lg" align="center" className="text-center">
          <TypingAnimation
            text={t(`moodResponses.${selectedMood}`)}
            speed={100}
            onComplete={() => setTimeout(() => setStep('courses'), 1500)}
            className="text-display-sm md:text-display-md"
          />
        </Stack>
      )}

      {step === 'courses' && (
        <Section size="md" className="w-full max-w-content">
          <Stack gap="content-gap-lg" align="center">
            <h2 className="text-heading-xl text-center">{t('gradeQuestion')}</h2>
            {isLoadingCourses ? (
              <Text variant="muted">{t('loading')}</Text>
            ) : courses.length > 0 ? (
              <Grid cols={{ default: '1', md: '2', lg: '3' }} gap="content-gap-lg">
                {courses.map((course) => {
                  const color = getCourseColor(course.courseLabel)
                  return (
                    <AccentCard
                      key={course.id}
                      accentColor={color}
                      accentPosition="top"
                      onClick={() => handleCourseSelect(course)}
                      className="cursor-pointer h-full flex flex-col"
                    >
                      <div className="p-5">
                        {course.courseLabel && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color }}
                          >
                            {course.courseLabel}
                          </span>
                        )}
                        <h3 className="text-body-lg font-bold text-card-foreground mt-1">
                          {course.title}
                        </h3>
                        {course.description && (
                          <p className="text-body-xs text-muted-foreground mt-2 line-clamp-2">
                            {course.description}
                          </p>
                        )}
                      </div>
                    </AccentCard>
                  )
                })}
              </Grid>
            ) : (
              <Text variant="muted">{t('noCoursesAvailable')}</Text>
            )}
          </Stack>
        </Section>
      )}

      {step === 'complete' && (
        <Stack gap="content-gap" align="center">
          <TypingAnimation text={t('letsStart')} speed={100} className="text-display-sm" />
        </Stack>
      )}
    </Section>
  )
}
