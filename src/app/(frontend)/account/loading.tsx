import { Skeleton } from '@/ui/web/components/skeleton'

export default function AccountLoading() {
  return (
    <div className="container py-section-md">
      <div className="mx-auto max-w-2xl space-y-content-gap">
        {/* Page title */}
        <Skeleton className="h-9 w-36" />

        {/* Profile card */}
        <div className="rounded-lg border bg-card p-card-padding space-y-6">
          {/* Avatar + name */}
          <div className="flex items-center gap-content-gap">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-md" />
            ))}
          </div>

          {/* Settings rows */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-border"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
