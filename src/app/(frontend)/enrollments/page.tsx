/**
 * Enrollments Page
 *
 * @fileType page
 * @domain lms
 * @pattern enrollment
 * @ai-summary Student enrollment dashboard — view and manage course enrollment requests
 */

import { redirect } from 'next/navigation'
import { getMeUser } from '@/infra/utils/getMeUser'
import { EnrollmentsPageContent } from './_components/EnrollmentsPageContent'

export const metadata = { title: 'My Enrollments' }

export default async function EnrollmentsPage() {
  const { user } = await getMeUser()

  if (!user) {
    redirect('/login')
  }

  return <EnrollmentsPageContent user={user} />
}
