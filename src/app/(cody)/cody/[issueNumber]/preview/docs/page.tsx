/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with preview modal on Docs tab via URL /cody/[n]/preview/docs
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'

export const metadata: Metadata = {
  title: 'Cody Operations Dashboard — Docs',
  description: 'Developer operations dashboard for monitoring Cody CI build agent',
}

export default async function CodyPreviewDocsPage({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}) {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    const { issueNumber } = await params
    const returnTo = `/cody/${issueNumber}/preview/docs`
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  }

  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)

  if (isNaN(parsed)) {
    redirect('/cody')
  }

  return <CodyDashboard initialIssueNumber={parsed} />
}
