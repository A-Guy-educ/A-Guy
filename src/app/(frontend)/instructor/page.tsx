/**
 * Instructor Dashboard Page
 *
 * @fileType page
 * @domain lms
 * @pattern instructor-dashboard
 * @ai-summary Dashboard for instructors to view their assigned courses and student progress
 */

import { redirect } from 'next/navigation'

import { AccountRole } from '@/infra/auth/roles'
import { getMeUser } from '@/infra/utils/getMeUser'
import { InstructorDashboardContent } from './_components/InstructorDashboardContent'

export const metadata = { title: 'Instructor Dashboard' }

export default async function InstructorDashboardPage() {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== AccountRole.Instructor && user.role !== AccountRole.Admin) {
    redirect('/account')
  }

  return <InstructorDashboardContent userId={user.id} isAdmin={user.role === AccountRole.Admin} />
}
