/**
 * Geometry Renderer
 * Renders geometric shapes and diagrams
 */

import React from 'react'
import type { GeometryBlock } from '@/contracts'
import { GeometryPreview } from '@/components/admin/ExerciseEditor/previews/GeometryPreview'
import './index.scss'

const baseClass = 'geometry-renderer'

interface GeometryRendererProps {
  block: GeometryBlock
}

export function GeometryRenderer({ block }: GeometryRendererProps) {
  return (
    <div className={baseClass}>
      <GeometryPreview spec={block.spec} />
    </div>
  )
}
