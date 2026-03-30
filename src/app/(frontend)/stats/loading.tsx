import { Skeleton, SkeletonCard, SkeletonText } from '@/ui/web/components/skeleton'

export default function StatsLoading() {
  return (
    <div className="container mx-auto px-4 py-section-sm">
      <div className="space-y-content-gap">
        {/* Title */}
        <Skeleton className="h-9 w-48" />

        {/* Filters row */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>

        {/* Bento grid matching StatsDashboard layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-content-gap">
          {/* Summary cards — full width */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-card p-card-padding">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-content-gap">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category progress — full width */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-card p-card-padding space-y-4">
              <Skeleton className="h-5 w-40" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-content-gap">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-2 w-full rounded-full" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Practiced items — side by side */}
          <SkeletonCard />
          <SkeletonCard />

          {/* Activity timeline — full width */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border bg-card p-card-padding space-y-4">
              <Skeleton className="h-5 w-36" />
              <SkeletonText lines={5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
