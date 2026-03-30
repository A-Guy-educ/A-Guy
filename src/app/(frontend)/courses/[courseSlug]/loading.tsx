import { Skeleton, SkeletonCard } from '@/ui/web/components/skeleton'

export default function CourseDetailLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Tab area skeleton */}
      <div className="py-content-gap">
        <div className="bg-muted/50 p-1 rounded-full flex items-center justify-center gap-0 max-w-md mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-9 rounded-full" />
          ))}
        </div>
      </div>

      {/* Course title area */}
      <div className="w-full py-section-sm px-6">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <Skeleton className="h-10 w-80 mx-auto" />
        </div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 justify-center mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>

      {/* Main content — lesson card grid */}
      <main className="container mx-auto px-6 py-section-sm max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-content-gap-lg">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </main>
    </div>
  )
}
