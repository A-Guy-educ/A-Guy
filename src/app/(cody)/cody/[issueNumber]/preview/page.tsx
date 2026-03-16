/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with preview modal pre-opened via URL /cody/[n]/preview.
 *   Force static with generateStaticParams for OG tags.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildTaskMetadata } from '../../metadata'

// Force static generation so OG tags are available without authentication
export const dynamic = 'force-static'
export const revalidate = false
export const fetchCache = 'force-cache'

// Pre-render common issue numbers at build time for OG tags
export async function generateStaticParams() {
  const issueNumbers = Array.from({ length: 50 }, (_, i) => ({
    issueNumber: String(i + 800),
  }))
  return issueNumbers
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issueNumber: string }>
}): Promise<Metadata> {
  const { issueNumber } = await params
  const parsed = parseInt(issueNumber, 10)
  if (isNaN(parsed)) return { title: 'Cody Operations Dashboard' }
  return buildTaskMetadata(parsed, { suffix: 'Preview', path: `/cody/${parsed}/preview` })
}

export default async function CodyPreviewPage({
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
