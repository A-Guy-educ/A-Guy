/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with create task dialog pre-opened via URL /cody/new
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Create Task — Cody Operations Dashboard',
  description: 'Create a new task for the Cody AI build agent',
  path: '/cody/new',
})

export default async function CodyNewTaskPage() {
  return <CodyDashboard initialModal="new" />
}
