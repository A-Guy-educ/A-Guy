'use client'

import type { User } from '@/payload-types'
import { PageTransition } from '@/ui/web/components/page-transition'
import { Button } from '@/ui/web/components/button'
import { useTranslations } from '@/ui/web/providers/I18n'
import { BookOpen, CheckCircle2, Clock, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type EnrollmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

interface Enrollment {
  id: string
  student: string | { id: string; name?: string; email?: string }
  course: string | { id: string; title?: string; slug?: string }
  status: EnrollmentStatus
  requestReason?: string
  requestedAt: string
  processedAt?: string
  expiresAt?: string
  grantMethod?: string
  notes?: string
}

interface EnrollmentsResponse {
  enrollments: Enrollment[]
  totalPages: number
  totalDocs: number
  page: number
  limit: number
}

function statusConfig(status: EnrollmentStatus) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', icon: CheckCircle2, color: 'text-success' }
    case 'pending':
      return { label: 'Pending', icon: Clock, color: 'text-warning' }
    case 'rejected':
      return { label: 'Rejected', icon: XCircle, color: 'text-error' }
    case 'cancelled':
      return { label: 'Cancelled', icon: XCircle, color: 'text-muted-foreground' }
    case 'expired':
      return { label: 'Expired', icon: AlertCircle, color: 'text-muted-foreground' }
    default:
      return { label: status, icon: AlertCircle, color: 'text-muted-foreground' }
  }
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface EnrollmentCardProps {
  enrollment: Enrollment
  onCancel: (id: string) => void
  cancelling: boolean
}

function EnrollmentCard({ enrollment, onCancel, cancelling }: EnrollmentCardProps) {
  const t = useTranslations('enrollment')
  const courseTitle = typeof enrollment.course === 'string'
    ? enrollment.course
    : enrollment.course?.title ?? 'Unknown Course'
  const courseSlug = typeof enrollment.course === 'string'
    ? undefined
    : enrollment.course?.slug
  const { label, icon: Icon, color } = statusConfig(enrollment.status)

  return (
    <div className="border border-border rounded-elevation-2 p-6 transition-all duration-normal hover:shadow-card-hover bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`mt-0.5 shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-body-md font-semibold text-foreground truncate">
              {courseTitle}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
              <span className={`font-medium ${color}`}>{label}</span>
              <span>
                {t('requestedOn')}{' '}
                <span className="font-medium text-foreground">
                  {formatDate(enrollment.requestedAt)}
                </span>
              </span>
              {enrollment.processedAt && (
                <span>
                  {t('processedOn')}{' '}
                  <span className="font-medium text-foreground">
                    {formatDate(enrollment.processedAt)}
                  </span>
                </span>
              )}
            </div>
            {enrollment.expiresAt && enrollment.status === 'approved' && (
              <p className="mt-1 text-body-sm text-muted-foreground">
                {t('expiresOn')}{' '}
                <span className="font-medium text-foreground">
                  {formatDate(enrollment.expiresAt)}
                </span>
              </p>
            )}
            {enrollment.requestReason && (
              <p className="mt-2 text-body-sm text-muted-foreground italic">
                &ldquo;{enrollment.requestReason}&rdquo;
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {enrollment.status === 'approved' && courseSlug && (
            <Button size="sm" asChild className="shrink-0">
              <Link href={`/courses/${courseSlug}`}>
                <BookOpen className="w-4 h-4 me-1" />
                {t('goToCourse')}
              </Link>
            </Button>
          )}
          {enrollment.status === 'pending' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onCancel(enrollment.id)}
              disabled={cancelling}
              className="shrink-0"
            >
              {cancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('cancelRequest')
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function EnrollmentsPageContent({ user: _user }: { user: User }) {
  const t = useTranslations('enrollment')
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await fetch('/api/enrollments', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load enrollments')
      const data: EnrollmentsResponse = await res.json()
      setEnrollments(data.enrollments as Enrollment[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  const handleCancel = useCallback(async (id: string) => {
    setCancellingId(id)
    try {
      const res = await fetch(`/api/enrollments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Failed to cancel enrollment')
      await fetchEnrollments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel enrollment')
    } finally {
      setCancellingId(null)
    }
  }, [fetchEnrollments])

  const pending = enrollments.filter((e) => e.status === 'pending')
  const approved = enrollments.filter((e) => e.status === 'approved')
  const inactive = enrollments.filter((e) =>
    ['rejected', 'cancelled', 'expired'].includes(e.status),
  )

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-3xl space-y-section-gap">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-display-sm font-bold">{t('title')}</h1>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {t('subtitle')}
              </p>
            </div>
            <Button size="sm" asChild variant="secondary">
              <Link href="/courses">{t('browseCourses')}</Link>
            </Button>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-elevation-2 border border-error/30 bg-error/5 p-4 text-body-sm text-error">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Content */}
          {!loading && (
            <div className="space-y-section-gap">
              {/* Approved enrollments */}
              {approved.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-body-lg font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    {t('activeEnrollments')} ({approved.length})
                  </h2>
                  <div className="space-y-3">
                    {approved.map((e) => (
                      <EnrollmentCard
                        key={e.id}
                        enrollment={e}
                        onCancel={handleCancel}
                        cancelling={cancellingId === e.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Pending requests */}
              {pending.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-body-lg font-semibold">
                    <Clock className="w-4 h-4 text-warning" />
                    {t('pendingRequests')} ({pending.length})
                  </h2>
                  <div className="space-y-3">
                    {pending.map((e) => (
                      <EnrollmentCard
                        key={e.id}
                        enrollment={e}
                        onCancel={handleCancel}
                        cancelling={cancellingId === e.id}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Inactive enrollments */}
              {inactive.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-body-lg font-semibold text-muted-foreground">
                    <XCircle className="w-4 h-4" />
                    {t('pastEnrollments')} ({inactive.length})
                  </h2>
                  <div className="space-y-3 opacity-70">
                    {inactive.map((e) => (
                      <EnrollmentCard
                        key={e.id}
                        enrollment={e}
                        onCancel={handleCancel}
                        cancelling={false}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {enrollments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
                  <h3 className="text-body-lg font-semibold">{t('noEnrollments')}</h3>
                  <p className="mt-1 text-body-sm text-muted-foreground max-w-xs">
                    {t('noEnrollmentsHint')}
                  </p>
                  <Button className="mt-4" asChild>
                    <Link href="/courses">{t('browseCourses')}</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
