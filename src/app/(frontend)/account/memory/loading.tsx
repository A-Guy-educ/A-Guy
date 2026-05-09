import { Skeleton } from '@/ui/web/components/skeleton'

export default function MemoryPageLoading() {
  return (
    <div className="container py-section-md">
      <div className="mx-auto max-w-2xl space-y-content-gap">
        {/* Page title */}
        <Skeleton className="h-9 w-36" />

        {/* Memory content area */}
        <div className="rounded-lg border bg-card p-card-padding space-y-6">
          {/* Empty state skeleton */}
          <div className="flex flex-col items-center gap-content-gap py-section-md text-center">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-40 mx-auto" />
              <Skeleton className="h-5 w-80 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
