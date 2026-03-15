/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page. Auth gate: GitHub OAuth session (any repo collaborator).
 *   Replaces the previous Payload admin-only gate.
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { verifyCodySessionToken, CODY_SESSION_COOKIE } from '@/infra/auth/cody_session'
import { buildCodyMetadata } from './metadata'

export const metadata = buildCodyMetadata({
  title: 'Cody Operations Dashboard',
  description: 'Monitor and manage AI coding agent tasks, pipelines, and deployments',
  path: '/cody',
})

export default async function CodyPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(CODY_SESSION_COOKIE)?.value
  const identity = await verifyCodySessionToken(token)

  // Not authenticated — redirect to GitHub OAuth
  if (!identity) {
    redirect('/api/oauth/github?returnTo=/cody')
  }

  return <CodyDashboard />
}
