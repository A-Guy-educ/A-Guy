import { Spinner } from '@/infra/loading/components/Spinner'

/**
 * Root loading component for frontend routes
 * Displays a centered spinner while server components render
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  )
}
