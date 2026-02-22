'use client'

import React from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'

interface AxisConfigPanelProps {
  spec: AxisSpecV1
  onChange: (spec: AxisSpecV1) => void
}

export const AxisConfigPanel: React.FC<AxisConfigPanelProps> = ({ spec, onChange }) => {
  const updateAxes = (updates: Partial<AxisSpecV1['axes']>) => {
    onChange({ ...spec, axes: { ...spec.axes, ...updates } })
  }

  const updateViewport = (updates: Partial<NonNullable<AxisSpecV1['viewport']>>) => {
    onChange({ ...spec, viewport: { ...spec.viewport, ...updates } })
  }

  return (
    <div className="axis-config-panel">
      <div className="canvas-config-row">
        <div className="panel-field">
          <span className="panel-field-label">Units</span>
          <input
            type="number"
            className="panel-field-input"
            value={spec.units}
            min={0.1}
            step={0.1}
            onChange={(e) => onChange({ ...spec, units: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Ticks</span>
          <input
            type="number"
            className="panel-field-input"
            value={spec.axes.ticks}
            min={0}
            onChange={(e) => updateAxes({ ticks: Number(e.target.value) || 0 })}
          />
        </div>
        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={spec.grid.enabled}
            onChange={(e) =>
              onChange({ ...spec, grid: { ...spec.grid, enabled: e.target.checked } })
            }
          />
          Grid
        </label>
        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={spec.axes.showNumbers}
            onChange={(e) => updateAxes({ showNumbers: e.target.checked })}
          />
          Numbers
        </label>
        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={spec.axes.showLabels}
            onChange={(e) => updateAxes({ showLabels: e.target.checked })}
          />
          Labels
        </label>
      </div>

      <div className="canvas-config-row" style={{ marginTop: 8 }}>
        <div className="panel-field">
          <span className="panel-field-label">X Label</span>
          <input
            type="text"
            className="panel-field-input"
            value={spec.axes.labels.x}
            onChange={(e) => updateAxes({ labels: { ...spec.axes.labels, x: e.target.value } })}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Y Label</span>
          <input
            type="text"
            className="panel-field-input"
            value={spec.axes.labels.y}
            onChange={(e) => updateAxes({ labels: { ...spec.axes.labels, y: e.target.value } })}
          />
        </div>
      </div>

      <div className="canvas-config-row" style={{ marginTop: 8 }}>
        <div className="panel-field">
          <span className="panel-field-label">X Min</span>
          <input
            type="number"
            className="panel-field-input"
            value={spec.viewport?.xMin ?? -10}
            onChange={(e) => updateViewport({ xMin: Number(e.target.value) })}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">X Max</span>
          <input
            type="number"
            className="panel-field-input"
            value={spec.viewport?.xMax ?? 10}
            onChange={(e) => updateViewport({ xMax: Number(e.target.value) })}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Y Min</span>
          <input
            type="number"
            className="panel-field-input"
            value={spec.viewport?.yMin ?? -10}
            onChange={(e) => updateViewport({ yMin: Number(e.target.value) })}
          />
        </div>
        <div className="panel-field">
          <span className="panel-field-label">Y Max</span>
          <input
            type="number"
            className="panel-field-input"
            value={spec.viewport?.yMax ?? 10}
            onChange={(e) => updateViewport({ yMax: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}
