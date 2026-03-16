/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with chat panel pre-opened via URL /cody/chat
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from '../metadata'

export const metadata = buildCodyMetadata({
  title: 'Chat — Cody Operations Dashboard',
  description: 'Chat with the Cody AI assistant about tasks and architecture',
  path: '/cody/chat',
})

export default async function CodyChatPage() {
  return <CodyDashboard initialModal="chat" />
}
