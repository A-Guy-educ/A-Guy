'use client'

import { useRouter } from 'next/navigation'
import type { Course } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { Badge } from '@/ui/web/components/badge'
import { ArrowRight } from 'lucide-react'
import { setUserProfile, getUserProfile } from '@/client/state/localStorage/userProfile'

interface CourseCardProps {
  course: Course
}

export function CourseCard({ course }: CourseCardProps) {
  const t = useTranslations('courses')
  const router = useRouter()

  if (!course.slug) {
    return null
  }

  const handleCourseSelect = () => {
    // Update localStorage with the selected course
    const gradeLevel = course.courseLabel || '8'
    const existingProfile = getUserProfile()

    setUserProfile({
      gradeLevel,
      mood: existingProfile?.mood || '',
      lastVisit: new Date().toISOString(),
    })

    // Navigate to the course page
    router.push(`/courses/${course.slug}`)
  }

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 rounded-xl opacity-0 group-hover:opacity-100 blur transition duration-500" />
      <Card className="relative overflow-hidden border-border bg-card backdrop-blur-sm hover:bg-card transition-all duration-300 h-full flex flex-col shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <CardHeader className="relative pb-4">
          {course.courseLabel && (
            <Badge variant="secondary" className="w-fit mb-3 text-xs font-medium">
              {course.courseLabel}
            </Badge>
          )}
          <CardTitle className="text-2xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
            {course.title}
          </CardTitle>
          {course.description && (
            <CardDescription className="line-clamp-3 text-muted-foreground/80 mt-2">
              {course.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardFooter className="relative mt-auto pt-4">
          <Button
            onClick={handleCourseSelect}
            className="w-full group/btn bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 flex items-center justify-center gap-2"
          >
            {t('openCourse')}
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
