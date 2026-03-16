/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page. Auth handled client-side via SessionExpiredError.
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from './metadata'

export const metadata = buildCodyMetadata({
  title: 'Cody Operations Dashboard',
  description: 'Monitor and manage AI coding agent tasks, pipelines, and deployments',
  path: '/cody',
})

export default async function CodyPage() {
  return <CodyDashboard />
}
