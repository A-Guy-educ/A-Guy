import { Skeleton, SkeletonCard } from '@/ui/web/components/skeleton'

export default function AskLoading() {
  return (
    <div>
      {/* Navigation bar placeholder */}
      <div className="h-14 bg-muted/30 animate-pulse" />

      {/* Conversation grid */}
      <div className="container mx-auto px-6 py-section-sm max-w-5xl">
        {/* Page title */}
        <Skeleton className="h-9 w-40 mb-content-gap-lg" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-content-gap">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
