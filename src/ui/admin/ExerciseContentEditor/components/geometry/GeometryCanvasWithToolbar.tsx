'use client'

import React, { useCallback, useState } from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { GeometryCanvas } from './GeometryCanvas'
import { GeometryToolbar, type GeometryMode } from './GeometryToolbar'

interface PointUpdate {
  name: string
  x: number
  y: number
}

interface GeometryCanvasWithToolbarProps {
  id: string
  geometry: GeometrySpecV1
  onPointMoved: (name: string, x: number, y: number) => void
  onMultiPointMoved?: (updates: PointUpdate[]) => void
  onPointAdded: (x: number, y: number) => void
  onGridToggle: (showGrid: boolean) => void
}

export const GeometryCanvasWithToolbar: React.FC<GeometryCanvasWithToolbarProps> = ({
  id,
  geometry,
  onPointMoved,
  onMultiPointMoved,
  onPointAdded,
  onGridToggle,
}) => {
  const [mode, setMode] = useState<GeometryMode>('move')
  const showGrid = geometry.canvas.grid ?? false

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      onPointAdded(x, y)
      setMode('move')
    },
    [onPointAdded],
  )

  const handleGridToggle = useCallback(() => {
    onGridToggle(!showGrid)
  }, [showGrid, onGridToggle])

  return (
    <div className="graph-editor-canvas">
      <GeometryToolbar
        mode={mode}
        showGrid={showGrid}
        onModeChange={setMode}
        onGridToggle={handleGridToggle}
      />
      <GeometryCanvas
        id={id}
        geometry={geometry}
        interactionMode={mode}
        onPointMoved={onPointMoved}
        onMultiPointMoved={onMultiPointMoved}
        onCanvasClick={handleCanvasClick}
      />
      {mode === 'addPoint' && (
        <div className="geo-canvas-hint">Click on the canvas to place a point</div>
      )}
    </div>
  )
}
