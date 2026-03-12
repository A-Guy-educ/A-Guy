/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with bug report dialog pre-opened via URL /cody/bug
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'

export const metadata: Metadata = {
  title: 'Report Bug — Cody Operations Dashboard',
  description: 'Report a bug for the Cody CI build agent',
}

export default async function CodyBugReportPage() {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody/bug')
  }

  return <CodyDashboard initialModal="bug" />
}
