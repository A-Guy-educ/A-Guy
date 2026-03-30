import { Skeleton, SkeletonText } from '@/ui/web/components/skeleton'

export default function LessonLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar with back button + title */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Progress bar */}
      <Skeleton className="h-1 w-full" />

      {/* Content area — two-pane layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Primary content pane */}
        <div className="flex-1 p-card-padding space-y-6">
          <Skeleton className="h-8 w-64" />
          <SkeletonText lines={6} />
          <Skeleton className="h-48 w-full rounded-lg" />
          <SkeletonText lines={4} />
        </div>

        {/* Chat sidebar skeleton (visible on lg+) */}
        <div className="hidden lg:block w-[400px] border-s border-border p-card-padding-sm space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
