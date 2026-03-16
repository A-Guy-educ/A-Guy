/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with create task dialog pre-opened via URL /cody/new.
 *   Force static for OG tags - social media crawlers need metadata without auth.
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from '../metadata'

// Force static generation so OG tags are available without authentication
export const dynamic = 'force-static'
export const revalidate = false
export const fetchCache = 'force-cache'

export const metadata = buildCodyMetadata({
  title: 'Create Task — Cody Operations Dashboard',
  description: 'Create a new task for the Cody AI build agent',
  path: '/cody/new',
})

export default async function CodyNewTaskPage() {
  return <CodyDashboard initialModal="new" />
}
