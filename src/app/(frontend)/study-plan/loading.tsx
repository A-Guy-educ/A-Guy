import { Skeleton } from '@/ui/web/components/skeleton'

export default function StudyPlanLoading() {
  return (
    <div>
      {/* Navigation bar placeholder */}
      <div className="h-14 bg-muted/30 animate-pulse" />

      <div className="container mx-auto px-6 py-section-sm max-w-3xl">
        {/* Page title */}
        <Skeleton className="h-9 w-48 mx-auto mb-content-gap-lg" />

        {/* Topic input area */}
        <div className="rounded-lg border bg-card p-card-padding space-y-4 mb-content-gap-lg">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-lg border border-border">
                <Skeleton className="h-4 w-32 flex-1" />
                <div className="flex gap-1">
                  <Skeleton className="h-7 w-14 rounded-md" />
                  <Skeleton className="h-7 w-14 rounded-md" />
                  <Skeleton className="h-7 w-14 rounded-md" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* Day cards */}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-card-padding space-y-3">
              <Skeleton className="h-6 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
