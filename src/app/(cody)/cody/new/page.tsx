/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with create task dialog pre-opened via URL /cody/new
 */
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Create Task — Cody Operations Dashboard',
  description: 'Create a new task for the Cody AI build agent',
  path: '/cody/new',
})

export default async function CodyNewTaskPage() {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody/new')
  }

  return <CodyDashboard initialModal="new" />
}
