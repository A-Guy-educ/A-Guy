'use client'

import React from 'react'
import { MousePointer2, Plus, Grid3x3 } from 'lucide-react'

export type GeometryMode = 'move' | 'addPoint'

interface GeometryToolbarProps {
  mode: GeometryMode
  showGrid: boolean
  onModeChange: (mode: GeometryMode) => void
  onGridToggle: () => void
}

export const GeometryToolbar: React.FC<GeometryToolbarProps> = ({
  mode,
  showGrid,
  onModeChange,
  onGridToggle,
}) => {
  return (
    <div className="geo-toolbar">
      <button
        type="button"
        className={`geo-toolbar-btn ${mode === 'move' ? 'geo-toolbar-btn--active' : ''}`}
        onClick={() => onModeChange('move')}
        title="Move / Select"
      >
        <MousePointer2 size={16} />
        <span>Move</span>
      </button>
      <button
        type="button"
        className={`geo-toolbar-btn ${mode === 'addPoint' ? 'geo-toolbar-btn--active' : ''}`}
        onClick={() => onModeChange('addPoint')}
        title="Click canvas to add a point"
      >
        <Plus size={16} />
        <span>Add Point</span>
      </button>
      <div className="geo-toolbar-separator" />
      <button
        type="button"
        className={`geo-toolbar-btn ${showGrid ? 'geo-toolbar-btn--active' : ''}`}
        onClick={onGridToggle}
        title={showGrid ? 'Hide grid' : 'Show grid'}
      >
        <Grid3x3 size={16} />
      </button>
    </div>
  )
}
