/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page with Kanban board and AI chat
 */
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'
import { buildCodyMetadata } from './metadata'

export const metadata = buildCodyMetadata({
  title: 'Cody Operations Dashboard',
  description: 'Monitor and manage AI coding agent tasks, pipelines, and deployments',
  path: '/cody',
})

export default async function CodyPage() {
  const { user } = await getMeUser()

  // Require admin role - redirect to login with returnTo for post-login redirect
  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody')
  }

  return <CodyDashboard />
}
