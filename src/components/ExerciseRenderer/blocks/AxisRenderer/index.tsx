/**
 * Axis System Renderer
 * Renders coordinate systems with axes, grids, points, and function graphs
 */

import React from 'react'
import type { AxisSystemBlock } from '@/contracts'
import { AxisPreview } from '@/components/admin/ExerciseEditor/previews/AxisPreview'
import './index.scss'

const baseClass = 'axis-renderer'

interface AxisRendererProps {
  block: AxisSystemBlock
}

export function AxisRenderer({ block }: AxisRendererProps) {
  return (
    <div className={baseClass}>
      <AxisPreview spec={block.spec} width={600} height={400} />
    </div>
  )
}
