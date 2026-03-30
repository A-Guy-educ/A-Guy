import { HealthBadge } from '@/ui/web/components/HealthBadge'

export default function ApiStatusPage() {
  return (
    <div className="container mx-auto py-section-sm">
      <h1 className="text-heading-xl text-foreground mb-content-gap">API Status</h1>
      <div className="flex items-center gap-content-gap">
        <HealthBadge showVersion />
      </div>
    </div>
  )
}
