/**
 * Stats Dashboard Page
 *
 * /stats - Student Statistics Dashboard
 */

import { redirect } from 'next/navigation'

import { getMeUser } from '@/infra/utils/getMeUser'
import { getPayload } from 'payload'
import config from '@payload-config'
import { StatsDashboard } from './_components/StatsDashboard'

interface StatsPageProps {
  searchParams: Promise<{
    courseId?: string
    timeframe?: string
  }>
}

export default async function StatsPage({ searchParams }: StatsPageProps) {
  // Auth gate - redirect to login if not authenticated
  const { user } = await getMeUser({
    nullUserRedirect: '/login',
  })

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const initialCourseId = params.courseId || 'all'
  const initialTimeframe = (params.timeframe as 'week' | 'month' | 'overall') || 'overall'

  // Fetch user's enrolled courses for the filter dropdown
  // For now, return all published courses
  const payload = await getPayload({ config })
  const coursesResult = await payload.find({
    collection: 'courses',
    where: {
      status: { equals: 'published' },
      isActive: { equals: true },
    },
    limit: 100,
    overrideAccess: true,
  })

  const courses = coursesResult.docs.map((course) => ({
    id: course.id,
    title: course.title || '',
    slug: course.slug || '',
  }))

  return (
    <div className="container mx-auto px-4 py-8">
      <StatsDashboard
        initialCourseId={initialCourseId}
        initialTimeframe={initialTimeframe}
        courses={courses}
      />
    </div>
  )
}
