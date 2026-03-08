/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page with Kanban board and AI chat
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'

// eslint-disable-next-line no-restricted-imports -- TODO: migrate to proper layer
import { AccountRole } from '@/server/payload/collections/Users/roles'

export const metadata: Metadata = {
  title: 'Cody Operations Dashboard',
  description: 'Developer operations dashboard for monitoring Cody CI build agent',
}

export default async function CodyPage() {
  const { user } = await getMeUser()

  // Require admin role - redirect to login with returnTo for post-login redirect
  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody')
  }

  return <CodyDashboard />
}
