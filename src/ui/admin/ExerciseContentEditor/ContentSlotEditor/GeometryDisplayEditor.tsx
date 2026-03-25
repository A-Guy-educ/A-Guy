'use client'

import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import React from 'react'
import { AnglesPanel } from '../components/geometry/AnglesPanel'
import { CanvasConfigPanel } from '../components/geometry/CanvasConfigPanel'
import { CirclesPanel } from '../components/geometry/CirclesPanel'
import { GeometryCanvasWithToolbar } from '../components/geometry/GeometryCanvasWithToolbar'
import { LinesPanel } from '../components/geometry/LinesPanel'
import { PointsPanel } from '../components/geometry/PointsPanel'
import { ShapesPanel } from '../components/geometry/ShapesPanel'
import { TextsPanel } from '../components/geometry/TextsPanel'
import { VectorsPanel } from '../components/geometry/VectorsPanel'

interface GeometryDisplayEditorProps {
  geometry: GeometrySpecV1
  onChange: (updates: { geometry: GeometrySpecV1 }) => void
}

/**
 * GeometryDisplayEditor - Display-only geometry editor for ContentSlot
 *
 * Stripped down from GeometryEditor - only shows canvas config and elements.
 * No prompt, answer, hint, or solution fields.
 */
export const GeometryDisplayEditor: React.FC<GeometryDisplayEditorProps> = ({
  geometry,
  onChange,
}) => {
  const updateGeometry = React.useCallback(
    (updates: Partial<GeometrySpecV1>) => {
      onChange({ geometry: { ...geometry, ...updates } })
    },
    [geometry, onChange],
  )

  const updateElements = React.useCallback(
    (updates: Partial<GeometrySpecV1['elements']>) => {
      updateGeometry({ elements: { ...geometry.elements, ...updates } })
    },
    [geometry.elements, updateGeometry],
  )

  // Generate unique ID for canvas
  const canvasId = React.useMemo(
    () => `geometry-display-${Math.random().toString(36).substring(7)}`,
    [],
  )

  // Handle canvas config changes
  const handleCanvasChange = React.useCallback(
    (canvasUpdates: { width?: number; height?: number; background?: string; grid?: boolean }) => {
      updateGeometry({ canvas: { ...geometry.canvas, ...canvasUpdates } })
    },
    [geometry.canvas, updateGeometry],
  )

  // Handle point drag
  const handlePointMoved = React.useCallback(
    (name: string, x: number, y: number) => {
      const newPoints = geometry.elements.points.map((p) => (p.name === name ? { ...p, x, y } : p))
      updateElements({ points: newPoints })
    },
    [geometry.elements.points, updateElements],
  )

  // Handle adding new point
  const handlePointAdded = React.useCallback(
    (x: number, y: number) => {
      const nextIndex = geometry.elements.points.length + 1
      const name = String.fromCharCode(64 + nextIndex) // A, B, C, ...
      updateElements({
        points: [...geometry.elements.points, { name, x, y, position: 'r' }],
      })
    },
    [geometry.elements.points, updateElements],
  )

  // Handle grid toggle
  const handleGridToggle = React.useCallback(
    (showGrid: boolean) => {
      updateGeometry({ canvas: { ...geometry.canvas, grid: showGrid } })
    },
    [geometry.canvas, updateGeometry],
  )

  // Handle text moved
  const handleTextMoved = React.useCallback(
    (index: number, x: number, y: number) => {
      const newTexts = (geometry.elements.texts || []).map((t, i) =>
        i === index ? { ...t, place: { ...t.place, x, y } } : t,
      )
      updateElements({ texts: newTexts })
    },
    [geometry.elements.texts, updateElements],
  )

  // Handle point label moved
  const handlePointLabelMoved = React.useCallback(
    (name: string, position: string) => {
      type PointPosition = GeometrySpecV1['elements']['points'][number]['position']
      const newPoints = geometry.elements.points.map((p) =>
        p.name === name ? { ...p, position: position as PointPosition } : p,
      )
      updateElements({ points: newPoints })
    },
    [geometry.elements.points, updateElements],
  )

  return (
    <div className="geometry-display-editor">
      <div className="geometry-display-editor-panels">
        <div className="geometry-display-editor-form">
          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">Canvas</div>
            <CanvasConfigPanel canvas={geometry.canvas} onChange={handleCanvasChange} />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">
              Points ({geometry.elements.points.length})
            </div>
            <PointsPanel
              points={geometry.elements.points}
              onChange={(points) => updateElements({ points })}
            />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">
              Lines ({geometry.elements.lines.length})
            </div>
            <LinesPanel
              points={geometry.elements.points}
              lines={geometry.elements.lines}
              onChange={(lines) => updateElements({ lines })}
            />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">
              Circles ({geometry.elements.circles.length})
            </div>
            <CirclesPanel
              points={geometry.elements.points}
              circles={geometry.elements.circles}
              onChange={(circles) => updateElements({ circles })}
            />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">
              Angles ({geometry.elements.angles.length})
            </div>
            <AnglesPanel
              points={geometry.elements.points}
              angles={geometry.elements.angles}
              onChange={(angles) => updateElements({ angles })}
            />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">
              Vectors ({(geometry.elements.vectors || []).length})
            </div>
            <VectorsPanel
              vectors={geometry.elements.vectors || []}
              points={geometry.elements.points}
              onChange={(vectors) => updateElements({ vectors })}
            />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">Shapes</div>
            <ShapesPanel
              triangles={geometry.elements.triangles || []}
              rectangles={geometry.elements.rectangles || []}
              points={geometry.elements.points}
              onTrianglesChange={(triangles) => updateElements({ triangles })}
              onRectanglesChange={(rectangles) => updateElements({ rectangles })}
            />
          </div>

          <div className="geometry-display-editor-panel">
            <div className="geometry-display-editor-panel-header">
              Texts ({(geometry.elements.texts || []).length})
            </div>
            <TextsPanel
              texts={geometry.elements.texts || []}
              onChange={(texts) => updateElements({ texts })}
            />
          </div>
        </div>

        <div className="geometry-display-editor-preview">
          <GeometryCanvasWithToolbar
            id={canvasId}
            geometry={geometry}
            onPointMoved={handlePointMoved}
            onPointAdded={handlePointAdded}
            onGridToggle={handleGridToggle}
            onTextMoved={handleTextMoved}
            onPointLabelMoved={handlePointLabelMoved}
          />
        </div>
      </div>
    </div>
  )
}
