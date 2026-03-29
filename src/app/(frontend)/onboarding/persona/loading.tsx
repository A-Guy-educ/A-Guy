import { Skeleton } from '@/ui/web/components/skeleton'

export default function PersonaLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      {/* Title + subtitle */}
      <div className="text-center mb-8 space-y-3">
        <Skeleton className="h-9 w-56 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
      </div>

      {/* Persona cards grid */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-content-gap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-card-padding space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-8">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  )
}
