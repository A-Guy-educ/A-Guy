'use client'

/**
 * Axis System Block Editor - Phase 1
 * Minimal spec builder with form controls + JSON advanced panel
 */

import React from 'react'
import type { AxisSystemBlock, AxisSpecV1 } from '@/contracts'
import type { BlockEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { AdvancedJsonPanel } from '../shared/AdvancedJsonPanel'
import { AxisPreview } from './previews/AxisPreview'
import { PreviewErrorBoundary } from './previews/ErrorBoundary'

export function AxisSystemBlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  errors,
}: BlockEditorProps<AxisSystemBlock>) {
  const { spec } = block

  const updateSpec = (updates: Partial<AxisSpecV1>) => {
    onChange({
      ...block,
      spec: { ...spec, ...updates } as AxisSpecV1,
    })
  }

  const addGraph = () => {
    const newGraph = {
      id: `g${Date.now()}`,
      fn: '2*x^2+3',
      style: 'solid' as const,
      thickness: 2,
      color: '#2563eb',
    }
    updateSpec({
      elements: {
        ...spec.elements,
        graphs: [...spec.elements.graphs, newGraph],
      },
    })
  }

  const removeGraph = (id: string) => {
    updateSpec({
      elements: {
        ...spec.elements,
        graphs: spec.elements.graphs.filter((g) => g.id !== id),
      },
    })
  }

  const updateGraph = (id: string, updates: Partial<(typeof spec.elements.graphs)[0]>) => {
    updateSpec({
      elements: {
        ...spec.elements,
        graphs: spec.elements.graphs.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      },
    })
  }

  const addPoint = () => {
    const newPoint = {
      x: 0,
      y: 0,
      label: 'P',
      type: 'point' as const,
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
        <h4>Axis System (Cartesian)</h4>
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
        {/* Basic Configuration */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Units (pixels per unit)
            </label>
            <input
              type="number"
              value={spec.units}
              onChange={(e) => updateSpec({ units: parseFloat(e.target.value) || 50 })}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
              min="1"
              step="1"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              Show Grid
            </label>
            <input
              type="checkbox"
              checked={spec.grid.enabled}
              onChange={(e) => updateSpec({ grid: { ...spec.grid, enabled: e.target.checked } })}
              style={{ marginTop: '0.5rem' }}
            />
          </div>
        </div>

        {/* Axes Configuration */}
        <div
          style={{
            borderTop: '1px solid var(--theme-elevation-150)',
            paddingTop: '0.75rem',
            marginTop: '0.75rem',
          }}
        >
          <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Axes Labels</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                X-axis label
              </label>
              <input
                type="text"
                value={spec.axes.labels.x}
                onChange={(e) =>
                  updateSpec({
                    axes: {
                      ...spec.axes,
                      labels: { ...spec.axes.labels, x: e.target.value },
                    },
                  })
                }
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                placeholder="x"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem' }}>
                Y-axis label
              </label>
              <input
                type="text"
                value={spec.axes.labels.y}
                onChange={(e) =>
                  updateSpec({
                    axes: {
                      ...spec.axes,
                      labels: { ...spec.axes.labels, y: e.target.value },
                    },
                  })
                }
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                placeholder="y"
              />
            </div>
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
                  value={point.label || ''}
                  onChange={(e) => updatePoint(idx, { label: e.target.value })}
                  placeholder="Label"
                  style={{ width: '5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                />
                <input
                  type="number"
                  value={point.x}
                  onChange={(e) => updatePoint(idx, { x: parseFloat(e.target.value) || 0 })}
                  placeholder="x"
                  style={{ width: '5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  step="0.1"
                />
                <input
                  type="number"
                  value={point.y}
                  onChange={(e) => updatePoint(idx, { y: parseFloat(e.target.value) || 0 })}
                  placeholder="y"
                  style={{ width: '5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  step="0.1"
                />
                <select
                  value={point.type}
                  onChange={(e) =>
                    updatePoint(idx, { type: e.target.value as 'point' | 'hole' | 'floating_text' })
                  }
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <option value="point">Point</option>
                  <option value="hole">Hole</option>
                  <option value="floating_text">Text</option>
                </select>
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

        {/* Graphs/Functions */}
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
            <h4 style={{ fontSize: '0.875rem' }}>Graphs (Functions)</h4>
            <button
              type="button"
              onClick={addGraph}
              className="btn btn--style-secondary btn--size-small"
            >
              + Add Graph
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {spec.elements.graphs.map((graph) => (
              <div
                key={graph.id}
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
                  value={graph.fn}
                  onChange={(e) => updateGraph(graph.id, { fn: e.target.value })}
                  placeholder="e.g., 2*x^2+3"
                  style={{
                    flex: 1,
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                  }}
                />
                <select
                  value={graph.style}
                  onChange={(e) =>
                    updateGraph(graph.id, {
                      style: e.target.value as 'solid' | 'dashed' | 'dotted',
                    })
                  }
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeGraph(graph.id)}
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
            <PreviewErrorBoundary fallbackTitle="Axis Preview Error">
              <AxisPreview spec={spec} width={600} height={400} />
            </PreviewErrorBoundary>
          </div>
        </div>

        {/* Advanced JSON Panel */}
        <AdvancedJsonPanel
          value={spec}
          onChange={(newSpec) => updateSpec(newSpec as Partial<AxisSpecV1>)}
          label="Advanced: Axis Spec JSON"
        />
      </div>
    </div>
  )
}
