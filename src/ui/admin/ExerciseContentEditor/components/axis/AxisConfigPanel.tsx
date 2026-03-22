'use client'

import React, { useMemo, useRef } from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import {
  calculateAutoViewport,
  validateViewportRange,
  checkGraphVisibility,
} from '@/infra/utils/graphics/viewport-utils'

interface AxisConfigPanelProps {
  spec: AxisSpecV1
  onChange: (spec: AxisSpecV1) => void
}

export const AxisConfigPanel: React.FC<AxisConfigPanelProps> = ({ spec, onChange }) => {
  const specRef = useRef(spec)
  specRef.current = spec

  const isManualMode = spec.viewportMode === 'manual'

  // Calculate initial validation state
  const validation = useMemo(() => {
    if (!isManualMode || !spec.viewport) {
      return { valid: true, errors: [] }
    }
    return validateViewportRange({
      xMin: spec.viewport.xMin ?? -10,
      xMax: spec.viewport.xMax ?? 10,
      yMin: spec.viewport.yMin ?? -10,
      yMax: spec.viewport.yMax ?? 10,
    })
  }, [spec.viewport, isManualMode])

  // Calculate visibility warning
  // Using specRef to avoid dependency on full spec object
  const visibility = useMemo(() => {
    if (!isManualMode || !spec.viewport) {
      return { visible: true, warning: null }
    }
    return checkGraphVisibility(specRef.current, {
      xMin: spec.viewport.xMin ?? -10,
      xMax: spec.viewport.xMax ?? 10,
      yMin: spec.viewport.yMin ?? -10,
      yMax: spec.viewport.yMax ?? 10,
    })
  }, [isManualMode, spec.viewport])

  const updateAxes = (updates: Partial<AxisSpecV1['axes']>) => {
    onChange({ ...spec, axes: { ...spec.axes, ...updates } })
  }

  const updateViewport = (updates: Partial<NonNullable<AxisSpecV1['viewport']>>) => {
    onChange({ ...spec, viewport: { ...spec.viewport, ...updates } })
  }

  const handleModeToggle = () => {
    if (isManualMode) {
      // Switch to auto mode - clear viewport values and set mode to auto
      onChange({
        ...spec,
        viewportMode: 'auto',
        viewport: undefined,
      })
    } else {
      // Switch to manual mode - calculate auto viewport and use as starting point
      const autoViewport = calculateAutoViewport(spec)
      onChange({
        ...spec,
        viewportMode: 'manual',
        viewport: {
          xMin: autoViewport.xMin,
          xMax: autoViewport.xMax,
          yMin: autoViewport.yMin,
          yMax: autoViewport.yMax,
        },
      })
    }
  }

  const handleViewportChange = (field: 'xMin' | 'xMax' | 'yMin' | 'yMax', value: string) => {
    const numValue = Number(value)
    if (Number.isNaN(numValue)) {
      // Don't update if not a valid number
      return
    }
    updateViewport({ [field]: numValue })
  }

  // Get current viewport values
  const currentViewport = spec.viewport
    ? {
        xMin: spec.viewport.xMin ?? -10,
        xMax: spec.viewport.xMax ?? 10,
        yMin: spec.viewport.yMin ?? -10,
        yMax: spec.viewport.yMax ?? 10,
      }
    : { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }

  // Calculate errors for each field
  const xMinError = validation.errors.find((e) => e.includes('X-min'))
  const yMinError = validation.errors.find((e) => e.includes('Y-min'))
  const xMaxError = validation.errors.find((e) => e.includes('X-max') || e.includes('X-min'))
  const yMaxError = validation.errors.find((e) => e.includes('Y-max') || e.includes('Y-min'))

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
        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={spec.axes.tickPosition?.x === 'inverted'}
            onChange={(e) =>
              updateAxes({
                tickPosition: {
                  ...(spec.axes.tickPosition ?? { x: 'default', y: 'default' }),
                  x: e.target.checked ? 'inverted' : 'default',
                },
              })
            }
          />
          Invert X Numbers
        </label>
        <label className="panel-checkbox-label">
          <input
            type="checkbox"
            checked={spec.axes.tickPosition?.y === 'inverted'}
            onChange={(e) =>
              updateAxes({
                tickPosition: {
                  ...(spec.axes.tickPosition ?? { x: 'default', y: 'default' }),
                  y: e.target.checked ? 'inverted' : 'default',
                },
              })
            }
          />
          Invert Y Numbers
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

      {/* Manual Range Toggle */}
      <div className="canvas-config-row" style={{ marginTop: 12 }}>
        <label className="panel-checkbox-label">
          <input type="checkbox" checked={isManualMode} onChange={handleModeToggle} />
          Manual Range
        </label>
      </div>

      {/* Viewport Fields - only shown in manual mode */}
      {isManualMode && (
        <>
          <div
            className={`canvas-config-row ${!isManualMode ? 'viewport-fields-disabled' : ''}`}
            style={{ marginTop: 8 }}
          >
            <div className="panel-field">
              <span className="panel-field-label">X Min</span>
              <input
                type="number"
                className="panel-field-input"
                key={`xMin-${currentViewport.xMin}`}
                defaultValue={currentViewport.xMin}
                onBlur={(e) => handleViewportChange('xMin', e.target.value)}
              />
              {xMinError && <span className="viewport-validation-error">{xMinError}</span>}
            </div>
            <div className="panel-field">
              <span className="panel-field-label">X Max</span>
              <input
                type="number"
                className="panel-field-input"
                key={`xMax-${currentViewport.xMax}`}
                defaultValue={currentViewport.xMax}
                onBlur={(e) => handleViewportChange('xMax', e.target.value)}
              />
              {xMaxError && !xMinError && (
                <span className="viewport-validation-error">{xMaxError}</span>
              )}
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Y Min</span>
              <input
                type="number"
                className="panel-field-input"
                key={`yMin-${currentViewport.yMin}`}
                defaultValue={currentViewport.yMin}
                onBlur={(e) => handleViewportChange('yMin', e.target.value)}
              />
              {yMinError && <span className="viewport-validation-error">{yMinError}</span>}
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Y Max</span>
              <input
                type="number"
                className="panel-field-input"
                key={`yMax-${currentViewport.yMax}`}
                defaultValue={currentViewport.yMax}
                onBlur={(e) => handleViewportChange('yMax', e.target.value)}
              />
              {yMaxError && !yMinError && (
                <span className="viewport-validation-error">{yMaxError}</span>
              )}
            </div>
          </div>

          {/* Empty Grid Warning */}
          {!visibility.visible && visibility.warning && (
            <div className="viewport-warning-banner">{visibility.warning}</div>
          )}
        </>
      )}
    </div>
  )
}
