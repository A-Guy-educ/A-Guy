import { Skeleton } from '@/ui/web/components/skeleton'

export default function ApiStatusLoading() {
  return (
    <div className="container mx-auto py-section-sm">
      {/* Page title */}
      <Skeleton className="h-9 w-36 mb-content-gap" />

      {/* Health badge */}
      <div className="flex items-center gap-content-gap">
        <Skeleton className="h-8 w-48 rounded-full" />
      </div>
    </div>
  )
}
