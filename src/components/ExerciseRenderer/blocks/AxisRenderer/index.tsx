/**
 * Axis System Renderer
 * Renders coordinate systems with axes, grids, points, and function graphs
 */

// For now, always render the client component or nothing if SSR issues arise.
// But we want the interactive component.
import dynamic from 'next/dynamic'
import { AxisSpecV1 } from '@/contracts'

// Placeholder for AxisSystem since we are not supporting graphs workflows in this task.
export const AxisRenderer: React.FC<{
  blockId: string
  spec: AxisSpecV1
}> = ({ blockId, spec }) => {
  return (
    <div className="my-8 border rounded-lg overflow-hidden border-border bg-card p-4 text-center text-muted-foreground">
      Axis System (Not Supported)
    </div>
  )
}
