/**
 * Geometry Renderer
 * Renders geometric shapes and diagrams
 */

import { GeometrySpecV1 } from '@/infra/contracts'

// Placeholder for GeometrySystem since we are not supporting graphs workflows in this task.
export const GeometryRenderer: React.FC<{
  blockId: string
  spec: GeometrySpecV1
}> = ({ blockId: _blockId, spec: _spec }) => {
  return (
    <div className="mb-4 flex justify-center">
      <div className="my-8 border rounded-lg overflow-hidden border-border bg-card p-4 text-center text-muted-foreground">
        Geometry System (Not Supported)
      </div>
    </div>
  )
}
