import { HealthBadge } from '@/ui/web/components/HealthBadge'

export const dynamic = 'force-dynamic'

export default function ApiStatusPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">API Status</h1>
      <div className="flex items-center gap-4">
        <HealthBadge showVersion />
      </div>
    </div>
  )
}
