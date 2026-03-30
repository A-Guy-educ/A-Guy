import { Skeleton, SkeletonCard } from '@/ui/web/components/skeleton'

export default function StudyLoading() {
  return (
    <div>
      {/* Navigation bar placeholder */}
      <div className="h-14 bg-muted/30 animate-pulse" />

      {/* Course context header */}
      <div className="w-full py-section-sm px-6">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          {/* Grade badge */}
          <Skeleton className="h-7 w-24 rounded-full mx-auto" />

          {/* Course title */}
          <Skeleton className="h-10 w-72 mx-auto" />

          {/* Progress bar */}
          <div className="max-w-sm mx-auto space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Lesson grid */}
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
