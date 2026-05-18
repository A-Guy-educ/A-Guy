'use client'

import { useState } from 'react'
import { Clock, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/ui/web/components/button'
import { Progress } from '@/ui/web/components/progress'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { User } from '@/payload-types'
import { DisplayModeToggle } from './DisplayModeToggle'

type DisplayMode = 'interactive' | 'scroll' | 'pdf'
type LessonType = 'learning' | 'practice' | 'exam'

interface LessonEntryPageProps {
  lesson: {
    id: string
    title: string
    type: LessonType
    description: string | null
    estimatedTime: number
    availableDisplayModes: DisplayMode[]
    createdBy: User | null
  }
  courseSlug: string
  chapterSlug: string
  lessonSlug: string
  isNewUser: boolean
  progressPercent: number
  availableModes: DisplayMode[]
  defaultMode: DisplayMode
  gradeLevel: string
}

function getLessonTypeBadgeLabel(type: LessonType, t: (key: string) => string): string {
  switch (type) {
    case 'learning':
      return t('learning')
    case 'practice':
      return t('practice')
    case 'exam':
      return t('exam')
    default:
      return t('lesson')
  }
}

function getPrimaryButtonText(
  isNewUser: boolean,
  isExam: boolean,
  t: (key: string) => string,
): string {
  if (isExam) {
    return isNewUser ? t('startExam') : t('continueExam')
  }
  return isNewUser ? t('startLesson') : t('continueLesson')
}

function getSecondaryButtonText(isExam: boolean, t: (key: string) => string): string {
  return isExam ? t('restartExam') : t('restartLesson')
}

export function LessonEntryPage(props: LessonEntryPageProps) {
  const tc = useTranslations('courses')
  const [selectedMode, setSelectedMode] = useState<DisplayMode>(props.defaultMode)

  const isExam = props.lesson.type === 'exam'

  const primaryButtonText = getPrimaryButtonText(props.isNewUser, isExam, tc)
  const secondaryButtonText = getSecondaryButtonText(isExam, tc)

  const handleStart = () => {
    const href = `/courses/${props.courseSlug}/chapters/${props.chapterSlug}/lessons/${props.lessonSlug}?mode=${selectedMode}`
    window.location.href = href
  }

  const handleRestart = async () => {
    // Reset progress via POST to /api/progress
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recordType: 'lesson',
          recordId: props.lesson.id,
          completionPercentage: 0,
          status: 'not_started',
          gradeLevel: props.gradeLevel,
        }),
      })
    } catch {
      // Continue even if reset fails
    }

    const href = `/courses/${props.courseSlug}/chapters/${props.chapterSlug}/lessons/${props.lessonSlug}?mode=${selectedMode}`
    window.location.href = href
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-section-md md:py-section-lg">
        <div className="flex flex-col gap-content-gap">
          {/* Lesson Type Badge */}
          <div>
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                isExam
                  ? 'bg-warning/10 text-warning'
                  : props.lesson.type === 'practice'
                    ? 'bg-accent/10 text-accent'
                    : 'bg-primary/10 text-primary'
              }`}
            >
              {getLessonTypeBadgeLabel(props.lesson.type, tc)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-heading-xl font-heading text-foreground">{props.lesson.title}</h1>

          {/* Creator Credit */}
          {props.lesson.createdBy && (
            <p className="text-body-md text-muted-foreground">
              {typeof props.lesson.createdBy.name === 'string'
                ? props.lesson.createdBy.name
                : props.lesson.createdBy.email}
            </p>
          )}

          {/* Description */}
          {props.lesson.description && (
            <p className="text-body-lg text-foreground leading-relaxed">
              {props.lesson.description.replace(/<[^>]*>/g, '')}
            </p>
          )}

          {/* Estimated Time */}
          <div className="flex items-center gap-2 text-body-md text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              {tc('estimatedTime').replace('{minutes}', String(props.lesson.estimatedTime))}
            </span>
          </div>

          {/* Progress Bar (Returning User) */}
          {!props.isNewUser && (
            <div className="flex flex-col gap-2">
              <Progress value={props.progressPercent} />
              <p className="text-body-sm text-muted-foreground">
                {tc('completionPercent').replace('{percent}', String(props.progressPercent))}
              </p>
            </div>
          )}

          {/* Display Mode Toggle */}
          <DisplayModeToggle
            modes={props.availableModes}
            selected={selectedMode}
            onChange={setSelectedMode}
          />

          {/* Primary CTA */}
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleStart} size="lg" className="w-full gap-2">
              {props.isNewUser ? <Play className="w-4 h-4" /> : null}
              {primaryButtonText}
            </Button>

            {/* Secondary CTA (Returning User Only) */}
            {!props.isNewUser && (
              <Button variant="ghost" onClick={handleRestart} className="w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                {secondaryButtonText}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
