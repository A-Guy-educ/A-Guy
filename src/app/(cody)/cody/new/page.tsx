/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with create task dialog pre-opened via URL /cody/new
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'

export const metadata: Metadata = {
  title: 'Create Task — Cody Operations Dashboard',
  description: 'Create a new task for the Cody CI build agent',
}

export default async function CodyNewTaskPage() {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody/new')
  }

  return <CodyDashboard initialModal="new" />
}
