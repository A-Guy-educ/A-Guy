import { Spinner } from '@/infra/loading/components/Spinner'

/**
 * Root loading component for frontend routes
 * Displays a spinner while server components render
 * Works alongside RouteLoadingIndicator for client-side navigation
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" />
    </div>
  )
}
