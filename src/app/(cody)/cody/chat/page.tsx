/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with chat panel pre-opened via URL /cody/chat
 */
import { redirect } from 'next/navigation'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { getMeUser } from '@/infra/utils/getMeUser'
import { AccountRole } from '@/infra/auth/roles'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Chat — Cody Operations Dashboard',
  description: 'Chat with the Cody AI assistant about tasks and architecture',
  path: '/cody/chat',
})

export default async function CodyChatPage() {
  const { user } = await getMeUser()

  if (!user || user.role !== AccountRole.Admin) {
    redirect('/login?returnTo=/cody/chat')
  }

  return <CodyDashboard initialModal="chat" />
}
