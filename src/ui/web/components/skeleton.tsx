import { cn } from '@/infra/utils/ui'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-card-padding space-y-4', className)}>
      <Skeleton className="h-5 w-2/3" />
      <SkeletonText lines={2} />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard }
