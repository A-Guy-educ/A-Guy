import { SkeletonCard } from '@/ui/web/components/skeleton'

export default function CoursesLoading() {
  return (
    <div className="min-h-screen text-card-foreground antialiased">
      {/* Shop header skeleton */}
      <div className="py-section-md px-6">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-md mx-auto" />
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Catalog header skeleton */}
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md mb-content-gap-lg" />

        {/* Course card grid */}
        <div className="grid gap-content-gap-xl md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
