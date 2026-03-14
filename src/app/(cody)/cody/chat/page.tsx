/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with chat panel pre-opened via URL /cody/chat
 */
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { verifyCodySessionToken, CODY_SESSION_COOKIE } from '@/infra/auth/cody_session'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Chat — Cody Operations Dashboard',
  description: 'Chat with the Cody AI assistant about tasks and architecture',
  path: '/cody/chat',
})

export default async function CodyChatPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(CODY_SESSION_COOKIE)?.value
  const identity = await verifyCodySessionToken(token)

  // Not authenticated — redirect to GitHub OAuth
  if (!identity) {
    redirect('/api/oauth/github?returnTo=/cody/chat')
  }

  return <CodyDashboard initialModal="chat" />
}
