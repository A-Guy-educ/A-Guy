/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with a specific task pre-selected via URL
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { verifyCodySessionToken, CODY_SESSION_COOKIE } from '@/infra/auth/cody_session'
import { buildTaskMetadata } from '../metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}): Promise<Metadata> {
  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)
  if (isNaN(parsed)) return { title: 'Cody Operations Dashboard' }
  return buildTaskMetadata(parsed)
}

export default async function CodyTaskPage({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(CODY_SESSION_COOKIE)?.value
  const identity = await verifyCodySessionToken(token)

  // Not authenticated — redirect to GitHub OAuth
  if (!identity) {
    const { issueNumber } = await params
    const returnTo = `/cody/${issueNumber}`
    redirect(`/api/oauth/github?returnTo=${encodeURIComponent(returnTo)}`)
  }

  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)

  if (isNaN(parsed)) {
    redirect('/cody')
  }

  return <CodyDashboard initialIssueNumber={parsed} />
}
