/**
 * Geometry Renderer
 * Renders geometric shapes and diagrams
 */

// For now, always render the client component.
import dynamic from 'next/dynamic'
import { GeometrySpecV1 } from '@/contracts'

// Placeholder for GeometrySystem since we are not supporting graphs workflows in this task.
export const GeometryRenderer: React.FC<{
  blockId: string
  spec: GeometrySpecV1
}> = ({ blockId, spec }) => {
  return (
    <div className="my-8 border rounded-lg overflow-hidden border-border bg-card p-4 text-center text-muted-foreground">
      Geometry System (Not Supported)
    </div>
  )
}
