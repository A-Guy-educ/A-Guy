'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'

interface CanvasConfigPanelProps {
  canvas: GeometrySpecV1['canvas']
  onChange: (canvas: GeometrySpecV1['canvas']) => void
}

export const CanvasConfigPanel: React.FC<CanvasConfigPanelProps> = ({ canvas, onChange }) => {
  return (
    <div className="canvas-config-panel">
      <div className="canvas-config-row">
        <div className="panel-field">
          <span className="panel-field-label">Width</span>
          <input
            type="number"
            className="panel-field-input"
            value={canvas.width}
            onChange={(e) => onChange({ ...canvas, width: Number(e.target.value) || 600 })}
            min={100}
            max={2000}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Height</span>
          <input
            type="number"
            className="panel-field-input"
            value={canvas.height}
            onChange={(e) => onChange({ ...canvas, height: Number(e.target.value) || 400 })}
            min={100}
            max={2000}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Background</span>
          <input
            type="color"
            className="panel-color-input"
            value={canvas.background || '#ffffff'}
            onChange={(e) => onChange({ ...canvas, background: e.target.value })}
          />
        </div>
        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={canvas.grid ?? false}
            onChange={(e) => onChange({ ...canvas, grid: e.target.checked })}
          />
          Grid
        </label>
      </div>
    </div>
  )
}
