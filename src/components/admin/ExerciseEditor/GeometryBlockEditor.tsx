'use client'

/**
 * Geometry Block Editor - Phase 1
 * Minimal spec builder with form controls + JSON advanced panel
 */

import React from 'react'
import type { GeometryBlock, GeometrySpecV1 } from '@/contracts'
import type { BlockEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { AdvancedJsonPanel } from '../shared/AdvancedJsonPanel'
import { GeometryPreview } from './previews/GeometryPreview'

export function GeometryBlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  errors,
}: BlockEditorProps<GeometryBlock>) {
  const { spec } = block

  const updateSpec = (updates: Partial<GeometrySpecV1>) => {
    onChange({
      ...block,
      spec: { ...spec, ...updates } as GeometrySpecV1,
    })
  }

  const addPoint = () => {
    const newPoint = {
      name: `P${spec.elements.points.length + 1}`,
      x: 100,
      y: 100,
      visible: true,
    }
    updateSpec({
      elements: {
        ...spec.elements,
        points: [...spec.elements.points, newPoint],
      },
    })
  }

  const removePoint = (index: number) => {
    updateSpec({
      elements: {
        ...spec.elements,
        points: spec.elements.points.filter((_, i) => i !== index),
      },
    })
  }

  const updatePoint = (index: number, updates: Partial<(typeof spec.elements.points)[0]>) => {
    updateSpec({
      elements: {
        ...spec.elements,
        points: spec.elements.points.map((p, i) => (i === index ? { ...p, ...updates } : p)),
      },
    })
  }

  const addLine = () => {
    if (spec.elements.points.length < 2) {
      alert('Add at least 2 points before adding a line')
      return
    }
    const newLine = {
      from: spec.elements.points[0].name,
      to: spec.elements.points[1].name,
      style: 'solid' as const,
    }
    updateSpec({
      elements: {
        ...spec.elements,
        lines: [...spec.elements.lines, newLine],
      },
    })
  }

  const removeLine = (index: number) => {
    updateSpec({
      elements: {
        ...spec.elements,
        lines: spec.elements.lines.filter((_, i) => i !== index),
      },
    })
  }

  const updateLine = (index: number, updates: Partial<(typeof spec.elements.lines)[0]>) => {
    updateSpec({
      elements: {
        ...spec.elements,
        lines: spec.elements.lines.map((l, i) => (i === index ? { ...l, ...updates } : l)),
      },
    })
  }

  const pointNames = spec.elements.points.map((p) => p.name)

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h4>Geometry (Euclidean)</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="btn btn--style-secondary btn--size-small"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="btn btn--style-secondary btn--size-small"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn--style-secondary btn--size-small"
          >
            Delete
          </button>
        </div>
      </div>

      <ErrorDisplay errors={errors} />

      <div>
        {/* Canvas Configuration */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Canvas Width
            </label>
            <input
              type="number"
              value={spec.canvas.width}
              onChange={(e) =>
                updateSpec({
                  canvas: { ...spec.canvas, width: parseFloat(e.target.value) || 600 },
                })
              }
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
              min="100"
              step="10"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Canvas Height
            </label>
            <input
              type="number"
              value={spec.canvas.height}
              onChange={(e) =>
                updateSpec({
                  canvas: { ...spec.canvas, height: parseFloat(e.target.value) || 400 },
                })
              }
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
              min="100"
              step="10"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Show Grid
            </label>
            <input
              type="checkbox"
              checked={spec.canvas.grid || false}
              onChange={(e) =>
                updateSpec({
                  canvas: { ...spec.canvas, grid: e.target.checked },
                })
              }
              style={{ marginTop: '0.5rem' }}
            />
          </div>
        </div>

        {/* Points */}
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <h4 style={{ fontSize: '0.875rem' }}>Points</h4>
            <button
              type="button"
              onClick={addPoint}
              className="btn btn--style-secondary btn--size-small"
            >
              + Add Point
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {spec.elements.points.map((point, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--theme-elevation-50)',
                  borderRadius: '4px',
                }}
              >
                <input
                  type="text"
                  value={point.name}
                  onChange={(e) => updatePoint(idx, { name: e.target.value })}
                  placeholder="Name"
                  style={{ width: '6rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                />
                <input
                  type="number"
                  value={point.x}
                  onChange={(e) => updatePoint(idx, { x: parseFloat(e.target.value) || 0 })}
                  placeholder="x"
                  style={{ width: '6rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  step="1"
                />
                <input
                  type="number"
                  value={point.y}
                  onChange={(e) => updatePoint(idx, { y: parseFloat(e.target.value) || 0 })}
                  placeholder="y"
                  style={{ width: '6rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  step="1"
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={point.visible !== false}
                    onChange={(e) => updatePoint(idx, { visible: e.target.checked })}
                  />
                  Visible
                </label>
                <button
                  type="button"
                  onClick={() => removePoint(idx)}
                  className="btn btn--style-secondary btn--size-small"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Lines */}
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <h4 style={{ fontSize: '0.875rem' }}>Lines</h4>
            <button
              type="button"
              onClick={addLine}
              className="btn btn--style-secondary btn--size-small"
            >
              + Add Line
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {spec.elements.lines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: 'var(--theme-elevation-50)',
                  borderRadius: '4px',
                }}
              >
                <select
                  value={line.from}
                  onChange={(e) => updateLine(idx, { from: e.target.value })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  {pointNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>to</span>
                <select
                  value={line.to}
                  onChange={(e) => updateLine(idx, { to: e.target.value })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  {pointNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={line.style}
                  onChange={(e) => updateLine(idx, { style: e.target.value as 'solid' | 'dashed' })}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="btn btn--style-secondary btn--size-small"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Preview</h4>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <GeometryPreview spec={spec} />
          </div>
        </div>

        {/* Advanced JSON Panel */}
        <AdvancedJsonPanel
          value={spec}
          onChange={(newSpec) => updateSpec(newSpec as Partial<GeometrySpecV1>)}
          label="Advanced: Geometry Spec JSON"
        />
      </div>
    </div>
  )
}
