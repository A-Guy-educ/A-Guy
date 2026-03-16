/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with task detail on Comments tab via URL /cody/[n]/comments
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildTaskMetadata } from '../../metadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}): Promise<Metadata> {
  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)
  if (isNaN(parsed)) return { title: 'Cody Operations Dashboard' }
  return buildTaskMetadata(parsed, { suffix: 'Comments', path: `/cody/${parsed}/comments` })
}

export default async function CodyTaskCommentsPage({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}) {
  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)

  if (isNaN(parsed)) {
    redirect('/cody')
  }

  return <CodyDashboard initialIssueNumber={parsed} />
}
