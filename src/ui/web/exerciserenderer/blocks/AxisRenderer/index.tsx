/**
 * Axis System Renderer
 * Renders coordinate systems with axes, grids, points, and function graphs
 */

import { AxisSpecV1 } from '@/infra/contracts'

// Placeholder for AxisSystem since we are not supporting graphs workflows in this task.
export const AxisRenderer: React.FC<{
  blockId: string
  spec: AxisSpecV1
}> = ({ blockId: _blockId, spec: _spec }) => {
  return (
    <div className="mb-4 flex justify-center">
      <div className="my-8 border rounded-lg overflow-hidden border-border bg-card p-4 text-center text-muted-foreground">
        Axis System (Not Supported)
      </div>
    </div>
  )
}
