/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page. Auth handled client-side via SessionExpiredError.
 *   Force static for OG tags - social media crawlers need metadata without auth.
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from './metadata'

// Force static generation so OG tags are available without authentication
export const dynamic = 'force-static'
export const revalidate = false
export const fetchCache = 'force-cache'

export const metadata = buildCodyMetadata({
  title: 'Cody Operations Dashboard',
  description: 'Monitor and manage AI coding agent tasks, pipelines, and deployments',
  path: '/cody',
})

export default async function CodyPage() {
  return <CodyDashboard />
}
