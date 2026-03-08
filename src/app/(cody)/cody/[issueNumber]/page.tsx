/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with a specific task pre-selected via URL
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'

export const metadata: Metadata = {
  title: 'Cody Operations Dashboard',
  description: 'Developer operations dashboard for monitoring Cody CI build agent',
}

export default async function CodyTaskPage({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}) {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody')
  }

  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)

  if (isNaN(parsed)) {
    redirect('/cody')
  }

  return <CodyDashboard initialIssueNumber={parsed} />
}
