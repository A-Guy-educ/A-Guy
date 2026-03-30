import { Skeleton } from '@/ui/web/components/skeleton'

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-section-lg">
      {/* Heading */}
      <div className="text-center mb-6 px-4">
        <Skeleton className="h-10 w-48 mx-auto" />
      </div>

      {/* Login card */}
      <div className="w-full max-w-md px-4">
        <div className="rounded-lg border bg-card p-card-padding space-y-6">
          {/* OAuth buttons */}
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-px flex-1" />
          </div>

          {/* Email/password fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          {/* Submit button */}
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>

      {/* Help link */}
      <Skeleton className="h-4 w-32 mt-8" />
    </div>
  )
}
