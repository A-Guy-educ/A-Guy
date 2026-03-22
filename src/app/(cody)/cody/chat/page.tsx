/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Cody dashboard with chat panel pre-opened via URL /cody/chat.
 *   Force static for OG tags - social media crawlers need metadata without auth.
 */
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'
import { buildCodyMetadata } from '../metadata'

// Force static generation so OG tags are available without authentication
export const dynamic = 'force-static'
export const revalidate = false
export const fetchCache = 'force-cache'

export const metadata = buildCodyMetadata({
  title: 'Chat — Cody Operations Dashboard',
  description: 'Chat with the Cody AI assistant about tasks and architecture',
  path: '/cody/chat',
})

export default async function CodyChatPage() {
  return <CodyDashboard initialModal="chat" />
}
