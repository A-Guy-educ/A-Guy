'use client'

import { useEffect, useState } from 'react'

import { PageTransition } from '@/ui/web/components/page-transition'
import { useTranslations } from '@/ui/web/providers/I18n'

interface Course {
  id: string
  title: string
  slug: string
  courseLabel: string
}

interface DashboardData {
  courses: Course[]
  totalStudents: number
  totalCourses: number
}

export function InstructorDashboardContent({
  userId: _userId,
  isAdmin: _isAdmin,
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
              <div className="mt-8 grid gap-4 md:grid-cols-3">
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
            <div className="rounded-lg border border-error/50 bg-error/10 p-4 text-error">
              {error}
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="container py-section-md">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-display-sm font-bold">{t('title')}</h1>
            <p className="mt-1 text-text-secondary">{t('subtitle')}</p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold">{data?.totalCourses ?? 0}</div>
              <div className="text-sm text-text-secondary">{t('coursesAssigned')}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold">{data?.totalStudents ?? 0}</div>
              <div className="text-sm text-text-secondary">{t('totalStudents')}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-bold">—</div>
              <div className="text-sm text-text-secondary">{t('pendingGrading')}</div>
            </div>
          </div>

          {/* Courses List */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">{t('yourCourses')}</h2>
            {data?.courses && data.courses.length > 0 ? (
              <div className="space-y-3">
                {data.courses.map((course) => (
                  <a
                    key={course.id}
                    href={`/instructor/course/${course.id}`}
                    className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{course.title}</div>
                        <div className="text-sm text-text-secondary">{course.courseLabel}</div>
                      </div>
                      <div className="text-accent">→</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-text-secondary">
                {t('noCoursesAssigned')}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
