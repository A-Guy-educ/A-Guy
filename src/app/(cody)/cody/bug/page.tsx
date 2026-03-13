/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with bug report dialog pre-opened via URL /cody/bug
 */
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Report Bug — Cody Operations Dashboard',
  description: 'Report a bug for the Cody AI build agent',
  path: '/cody/bug',
})

export default async function CodyBugReportPage() {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody/bug')
  }

  return <CodyDashboard initialModal="bug" />
}
