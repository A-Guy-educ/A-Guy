'use client'

import { BookOpen, CheckCircle } from 'lucide-react'
import { cn } from '@/infra/utils/ui'
import { useRouterWithLoading } from '@/infra/loading/hooks/useRouterWithLoading'
import { setUserProfile, getUserProfile } from '@/client/state/localStorage/userProfile'
import type { Course } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Button } from '@/ui/web/components/button'

interface CourseCardProps {
  course: Course
  isOwned?: boolean
}

export function CourseCard({ course, isOwned = false }: CourseCardProps) {
  const t = useTranslations('courses')
  const router = useRouterWithLoading()

  // Early return if slug is missing or invalid
  if (!course.slug || course.slug.trim() === '' || course.slug === '-') {
    return null
  }

  const handleCourseSelect = (e: React.MouseEvent) => {
    e.preventDefault()

    // Double-check slug is valid before navigation
    if (!course.slug || course.slug.trim() === '' || course.slug === '-') {
      console.error('Cannot navigate: invalid course slug', course)
      return
    }

    // Update localStorage with the selected course
    const gradeLevel = course.courseLabel || '8'
    const existingProfile = getUserProfile()

    setUserProfile({
      gradeLevel,
      mood: existingProfile?.mood || '',
      lastVisit: new Date().toISOString(),
    })

    // Navigate to home page after localStorage is updated
    router.push('/')
  }

  const borderClass = isOwned
    ? 'border-2 border-[hsl(var(--primary))]/20'
    : 'border border-transparent hover:border-[hsl(var(--primary-soft))]'

  return (
    <div
      className={cn(
        'relative bg-card p-6 rounded-[2rem] flex flex-col',
        borderClass,
        'shadow-[0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)]',
        'transition-all hover:-translate-y-0.5',
      )}
    >
      {isOwned && (
        <span
          className="absolute -top-3 left-6 bg-[hsl(var(--success))] text-white px-4 py-1 rounded-full shadow-md uppercase tracking-wider"
          style={{ fontSize: '9px', fontWeight: 900 }}
        >
          הקורס שלך
        </span>
      )}

      <div className="mb-6 flex justify-between items-start gap-4">
        <div className="flex-1">
          {course.courseLabel && (
            <span
              className="block mb-1 uppercase tracking-widest text-primary"
              style={{ fontSize: '10px', fontWeight: 900 }}
            >
              {course.courseLabel}
            </span>
          )}
          <h4
            className="text-card-foreground text-right"
            style={{ fontSize: '20px', fontWeight: 900 }}
          >
            {course.title}
          </h4>
          {course.description && (
            <p
              className="text-muted-foreground mt-1 line-clamp-2 text-right"
              style={{ fontSize: '12px' }}
            >
              {course.description}
            </p>
          )}
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
            isOwned ? 'bg-[hsl(var(--success))]/10' : 'bg-muted',
          )}
        >
          {isOwned ? (
            <CheckCircle className="w-6 h-6 text-[hsl(var(--success))]" />
          ) : (
            <BookOpen className="w-6 h-6 text-primary" />
          )}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-border">
        <Button
          onClick={handleCourseSelect}
          className={cn(
            'w-full',
            isOwned
              ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20'
              : 'bg-muted text-primary hover:bg-[hsl(var(--primary-soft))]',
          )}
        >
          {t('openCourse')}
        </Button>
      </div>
    </div>
  )
}
