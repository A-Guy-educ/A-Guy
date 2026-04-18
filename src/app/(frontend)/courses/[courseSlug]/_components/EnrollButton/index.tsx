'use client'

import type { Course } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BookCheck, Loader2, PlusCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface EnrollmentInfo {
  status: 'none' | 'approved' | 'pending' | 'rejected' | 'cancelled' | 'expired'
  enrollmentId?: string
}

interface EnrollButtonProps {
  course: Course
  /** When true, the button links to the enrollment dashboard instead of enrolling directly */
  dashboard?: boolean
}

export function EnrollButton({ course, dashboard = false }: EnrollButtonProps) {
  const t = useTranslations('enrollment')
  const [enrollment, setEnrollment] = useState<EnrollmentInfo>({ status: 'none' })
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function checkEnrollment() {
      try {
        const res = await fetch('/api/enrollments', { credentials: 'include' })
        if (res.status === 401) {
          if (!cancelled) setEnrollment({ status: 'none' })
          return
        }
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          const matching = (data.enrollments ?? []).find(
            (e: { course?: string | { id?: string } }) => {
              const courseId = typeof e.course === 'string' ? e.course : e.course?.id
              return courseId === course.id
            },
          )
          if (matching) {
            setEnrollment({ status: matching.status, enrollmentId: matching.id })
          } else {
            setEnrollment({ status: 'none' })
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    checkEnrollment()
    return () => {
      cancelled = true
    }
  }, [course.id])

  const handleRequestEnrollment = useCallback(async () => {
    setRequesting(true)
    setError(null)
    try {
      const res = await fetch('/api/enrollments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId: course.id }),
      })
      if (res.status === 401) {
        window.location.href = `/login?redirect=/courses/${course.slug}`
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to request enrollment')
        return
      }
      const data = await res.json()
      setEnrollment({ status: 'pending', enrollmentId: data.enrollment?.id })
    } catch {
      setError('Failed to request enrollment')
    } finally {
      setRequesting(false)
    }
  }, [course.id, course.slug])

  if (loading) {
    return (
      <Button size="sm" variant="secondary" disabled>
        <Loader2 className="w-4 h-4 animate-spin me-1" />
        Loading...
      </Button>
    )
  }

  if (enrollment.status === 'approved') {
    if (dashboard) {
      return (
        <Button size="sm" variant="outline" asChild>
          <Link href="/enrollments">
            <BookCheck className="w-4 h-4 me-1" />
            {t('goToCourse')}
          </Link>
        </Button>
      )
    }
    return (
      <Button size="sm" variant="secondary" asChild>
        <Link href="/enrollments">
          <BookCheck className="w-4 h-4 me-1" />
          {t('activeEnrollments')}
        </Link>
      </Button>
    )
  }

  if (enrollment.status === 'pending') {
    return (
      <Button size="sm" variant="secondary" disabled>
        <Loader2 className="w-4 h-4 animate-spin me-1" />
        {t('pendingRequests')}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        onClick={handleRequestEnrollment}
        disabled={requesting}
        className="transition-all duration-normal"
      >
        {requesting ? (
          <Loader2 className="w-4 h-4 animate-spin me-1" />
        ) : (
          <PlusCircle className="w-4 h-4 me-1" />
        )}
        {t('requestEnrollment')}
      </Button>
      {error && (
        <p className="flex items-center gap-1 text-body-xs text-error">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
