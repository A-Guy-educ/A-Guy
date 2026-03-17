/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with bug report dialog pre-opened via URL /cody/bug.
 *   Force static for OG tags - social media crawlers need metadata without auth.
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from '../metadata'

// Force static generation so OG tags are available without authentication
export const dynamic = 'force-static'
export const revalidate = false
export const fetchCache = 'force-cache'

export const metadata = buildCodyMetadata({
  title: 'Report Bug — Cody Operations Dashboard',
  description: 'Report a bug for the Cody AI build agent',
  path: '/cody/bug',
})

export default async function CodyBugReportPage() {
  return <CodyDashboard initialModal="bug" />
}
