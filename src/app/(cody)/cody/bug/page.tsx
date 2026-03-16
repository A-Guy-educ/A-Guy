/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with bug report dialog pre-opened via URL /cody/bug
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Report Bug — Cody Operations Dashboard',
  description: 'Report a bug for the Cody AI build agent',
  path: '/cody/bug',
})

export default async function CodyBugReportPage() {
  return <CodyDashboard initialModal="bug" />
}
