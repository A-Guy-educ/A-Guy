/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with bug report dialog pre-opened via URL /cody/bug
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { verifyCodySessionToken, CODY_SESSION_COOKIE } from '@/infra/auth/cody_session'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Report Bug — Cody Operations Dashboard',
  description: 'Report a bug for the Cody AI build agent',
  path: '/cody/bug',
})

export default async function CodyBugReportPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(CODY_SESSION_COOKIE)?.value
  const identity = await verifyCodySessionToken(token)

  // Not authenticated — redirect to GitHub OAuth
  if (!identity) {
    redirect('/api/oauth/github?returnTo=/cody/bug')
  }

  return <CodyDashboard initialModal="bug" />
}
