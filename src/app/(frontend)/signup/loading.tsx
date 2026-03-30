import { Skeleton } from '@/ui/web/components/skeleton'

export default function SignupLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-section-lg">
      <div className="mx-auto max-w-md w-full px-4">
        {/* Title + subtitle */}
        <div className="text-center mb-8 space-y-2">
          <Skeleton className="h-9 w-40 mx-auto" />
          <Skeleton className="h-5 w-56 mx-auto" />
        </div>

        {/* Signup form card */}
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

          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          {/* Submit button */}
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
