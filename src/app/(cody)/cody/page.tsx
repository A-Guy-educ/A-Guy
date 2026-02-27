/**
 * @fileType page
 * @domain cody
 * @pattern dashboard-page
 * @ai-summary Main Cody dashboard page with Kanban board and AI chat
 */
import type { Metadata } from 'next'
import { CodyDashboard } from '@/ui/cody/components/CodyDashboard'

export const metadata: Metadata = {
  title: 'Cody Operations Dashboard',
  description: 'Developer operations dashboard for monitoring Cody CI build agent',
}

export default function CodyPage() {
  return <CodyDashboard />
}
