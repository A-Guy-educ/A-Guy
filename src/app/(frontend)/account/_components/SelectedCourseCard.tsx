'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { clearUserProfile, getUserProfile } from '@/client/state/localStorage/userProfile'
import { getClientSideURL } from '@/infra/utils/getURL'
import { Badge } from '@/ui/web/components/badge'
import { Button } from '@/ui/web/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'

interface Course {
  id: string
  courseLabel: string
  title: string
  description?: string
}

type LoadingState = 'loading' | 'error' | 'not-selected' | 'not-found' | 'success'

export function SelectedCourseCard() {
  const t = useTranslations('auth.account')
  const router = useRouter()
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [course, setCourse] = useState<Course | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const profile = getUserProfile()

    if (!profile?.gradeLevel) {
      setLoadingState('not-selected')
      return
    }

    fetchCourse(profile.gradeLevel, controller.signal)

    return () => {
      controller.abort()
    }
  }, [])

  const fetchCourse = async (gradeLevel: string, signal?: AbortSignal) => {
    setLoadingState('loading')
    try {
      const baseUrl = getClientSideURL()
      const params = new URLSearchParams({
        'where[courseLabel][equals]': gradeLevel,
        'where[status][equals]': 'published',
        'where[isActive][equals]': 'true',
        limit: '1',
        depth: '1',
      })

      const response = await fetch(`${baseUrl}/api/courses?${params.toString()}`, { signal })

      if (!response.ok) {
        throw new Error('Failed to fetch course')
      }

      const data = await response.json()

      if (data.docs && data.docs.length > 0) {
        const doc = data.docs[0]
        setCourse({
          id: doc.id,
          courseLabel: doc.courseLabel,
          title: doc.title,
          description: doc.description,
        })
        setLoadingState('success')
      } else {
        setLoadingState('not-found')
      }
    } catch (error) {
      // Silently ignore AbortError - don't set error state for aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      setLoadingState('error')
    }
  }

  const handleRemoveSelection = () => {
    clearUserProfile()
    router.replace('/')
  }

  const handleRetry = () => {
    const controller = new AbortController()
    const profile = getUserProfile()
    if (profile?.gradeLevel) {
      fetchCourse(profile.gradeLevel, controller.signal)
    }
  }

  if (loadingState === 'loading') {
    return (
      <Card className="border-s-4 border-s-primary">
        <CardHeader>
          <CardTitle>{t('selectedCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-section-md">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loadingState === 'not-selected') {
    return (
      <Card className="border-s-4 border-s-primary">
        <CardHeader>
          <CardTitle>{t('selectedCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm text-muted-foreground mb-4">{t('noCourseSelected')}</p>
          <Link href="/">
            <Button variant="outline">{t('selectCourse')}</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (loadingState === 'not-found') {
    return (
      <Card className="border-s-4 border-s-primary">
        <CardHeader>
          <CardTitle>{t('selectedCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm text-muted-foreground mb-4">{t('noCourseSelected')}</p>
          <Link href="/">
            <Button variant="outline">{t('selectCourse')}</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (loadingState === 'error') {
    return (
      <Card className="border-s-4 border-s-destructive">
        <CardHeader>
          <CardTitle>{t('selectedCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-body-sm text-destructive mb-4">Failed to load course</p>
          <Button onClick={handleRetry} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-s-4 border-s-primary">
      <CardHeader>
        <CardTitle>{t('selectedCourse')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {course && (
          <>
            <div className="flex items-start justify-between gap-content-gap">
              <div className="space-y-1">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-2"
                >
                  {course.courseLabel}
                </Badge>
                <p className="font-bold text-heading-md">{course.title}</p>
                {course.description && (
                  <p className="text-body-sm text-muted-foreground line-clamp-2">
                    {course.description}
                  </p>
                )}
              </div>
            </div>
            <Button onClick={handleRemoveSelection} variant="destructive" size="sm">
              {t('removeCourseSelection')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
