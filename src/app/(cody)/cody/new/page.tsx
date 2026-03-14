/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with create task dialog pre-opened via URL /cody/new
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { verifyCodySessionToken, CODY_SESSION_COOKIE } from '@/infra/auth/cody_session'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Create Task — Cody Operations Dashboard',
  description: 'Create a new task for the Cody AI build agent',
  path: '/cody/new',
})

export default async function CodyNewTaskPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(CODY_SESSION_COOKIE)?.value
  const identity = await verifyCodySessionToken(token)

  // Not authenticated — redirect to GitHub OAuth
  if (!identity) {
    redirect('/api/oauth/github?returnTo=/cody/new')
  }

  return <CodyDashboard initialModal="new" />
}
