'use client'

import { useEffect, useState } from 'react'

import { PageTransition } from '@/ui/web/components/page-transition'
import { useTranslations } from '@/ui/web/providers/I18n'

interface InstructorAssignment {
  id: string
  name: string
  role: 'primary' | 'ta' | 'guest'
}

interface Course {
  id: string
  title: string
  slug: string
  courseLabel: string
  instructors?: InstructorAssignment[]
}

interface DashboardData {
  courses: Course[]
  totalStudents: number
  totalCourses: number
}

function InstructorBadge({
  role,
  instructorName,
}: {
  role: 'primary' | 'ta' | 'guest'
  instructorName: string
}) {
  const t = useTranslations('lms.instructor')

  const roleColorClass =
    role === 'primary'
      ? 'bg-primary/10 text-primary border-primary/20'
      : role === 'ta'
        ? 'bg-secondary/10 text-secondary border-secondary/20'
        : 'bg-accent/10 text-accent border-accent/20'

  const roleLabel =
    role === 'primary'
      ? t('instructorRole.primary')
      : role === 'ta'
        ? t('instructorRole.ta')
        : t('instructorRole.guest')

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-body-xs font-medium ${roleColorClass}`}
    >
      <span className="font-semibold">{instructorName}</span>
      <span>—</span>
      <span>{roleLabel}</span>
    </span>
  )
}

export function InstructorDashboardContent({
  userId: _userId,
  isAdmin,
}: {
  userId: string
  isAdmin: boolean
}) {
  const t = useTranslations('lms.instructor')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/instructor/dashboard')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }
        const result = await response.json()
        setData(result.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <PageTransition>
        <div className="container py-section-md">
          <div className="mx-auto max-w-4xl">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded bg-muted"></div>
              <div className="h-4 w-96 rounded bg-muted"></div>
              <div className="mt-8 grid gap-content-gap-sm md:grid-cols-3">
                <div className="h-24 rounded bg-muted"></div>
                <div className="h-24 rounded bg-muted"></div>
                <div className="h-24 rounded bg-muted"></div>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  if (error) {
    return (
      <PageTransition>
        <div className="container py-section-md">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-lg border border-error/50 bg-error/10 p-card-padding-sm text-error">
              {error}
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  const heading = isAdmin ? t('adminDashboardTitle') : t('title')
  const subtitle = isAdmin ? t('adminDashboardSubtitle') : t('subtitle')

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-display-sm font-bold">{heading}</h1>
            <p className="mt-1 text-text-secondary">{subtitle}</p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-content-gap-sm md:grid-cols-3">
            <div className="rounded-lg border bg-card p-card-padding-sm">
              <div className="text-heading-xl font-bold">{data?.totalCourses ?? 0}</div>
              <div className="text-body-sm text-text-secondary">
                {isAdmin ? t('totalCoursesAdmin') : t('coursesAssigned')}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-card-padding-sm">
              <div className="text-heading-xl font-bold">{data?.totalStudents ?? 0}</div>
              <div className="text-body-sm text-text-secondary">{t('totalStudents')}</div>
            </div>
            <div className="rounded-lg border bg-card p-card-padding-sm">
              <div className="text-heading-xl font-bold">—</div>
              <div className="text-body-sm text-text-secondary">{t('pendingGrading')}</div>
            </div>
          </div>

          {/* Courses List */}
          <div>
            <h2 className="mb-4 text-body-lg font-semibold">
              {isAdmin ? t('allCourses') : t('yourCourses')}
            </h2>
            {data?.courses && data.courses.length > 0 ? (
              <div className="space-y-3">
                {data.courses.map((course) => (
                  <a
                    key={course.id}
                    href={`/instructor/course/${course.id}`}
                    className="block rounded-lg border bg-card p-card-padding-sm transition-all hover:border-primary/50 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{course.title}</div>
                        <div className="text-body-sm text-text-secondary">{course.courseLabel}</div>
                        {/* Admin view: show instructor badges */}
                        {isAdmin && course.instructors && course.instructors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {course.instructors.map((instructor) => (
                              <InstructorBadge
                                key={instructor.id}
                                role={instructor.role}
                                instructorName={instructor.name}
                              />
                            ))}
                          </div>
                        )}
                        {/* Instructor view: show empty state badge */}
                        {isAdmin &&
                          (!course.instructors || course.instructors.length === 0) && (
                            <span className="mt-2 inline-flex items-center rounded-full border border-dashed border-text-secondary/30 bg-muted px-2 py-0.5 text-body-xs text-text-secondary">
                              {t('noInstructorsAssigned')}
                            </span>
                          )}
                      </div>
                      <div className="ml-4 text-accent">→</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-card-padding-lg text-center text-text-secondary">
                {t('noCoursesAssigned')}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
