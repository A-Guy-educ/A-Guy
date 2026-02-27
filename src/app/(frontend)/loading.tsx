import { Spinner } from '@/infra/loading/components/Spinner'

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
