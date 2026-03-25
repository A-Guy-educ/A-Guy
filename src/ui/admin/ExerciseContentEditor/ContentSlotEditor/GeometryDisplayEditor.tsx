'use client'

import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import React from 'react'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'
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
 * Uses the same layout (graph-editor-layout) and CollapsibleSection panels
 * as the full GeometryEditor, without prompt/answer/hint fields.
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

  const canvasId = React.useMemo(
    () => `geometry-display-${Math.random().toString(36).substring(7)}`,
    [],
  )

  const handlePointMoved = React.useCallback(
    (name: string, x: number, y: number) => {
      const newPoints = geometry.elements.points.map((p) => (p.name === name ? { ...p, x, y } : p))
      updateElements({ points: newPoints })
    },
    [geometry.elements.points, updateElements],
  )

  const handlePointAdded = React.useCallback(
    (x: number, y: number) => {
      const nextIndex = geometry.elements.points.length + 1
      const name = String.fromCharCode(64 + nextIndex)
      updateElements({
        points: [...geometry.elements.points, { name, x, y, position: 'r' }],
      })
    },
    [geometry.elements.points, updateElements],
  )

  const handleGridToggle = React.useCallback(
    (showGrid: boolean) => {
      updateGeometry({ canvas: { ...geometry.canvas, grid: showGrid } })
    },
    [geometry.canvas, updateGeometry],
  )

  const handleTextMoved = React.useCallback(
    (index: number, x: number, y: number) => {
      const newTexts = (geometry.elements.texts || []).map((t, i) =>
        i === index ? { ...t, place: { ...t.place, x, y } } : t,
      )
      updateElements({ texts: newTexts })
    },
    [geometry.elements.texts, updateElements],
  )

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
    <div className="graph-editor-layout">
      <div className="graph-editor-form">
        <CollapsibleSection title="Canvas" defaultExpanded={false}>
          <CanvasConfigPanel
            canvas={geometry.canvas}
            onChange={(canvas) => updateGeometry({ canvas })}
          />
        </CollapsibleSection>

        <CollapsibleSection title={`Points (${geometry.elements.points.length})`} defaultExpanded>
          <PointsPanel
            points={geometry.elements.points}
            onChange={(points) => updateElements({ points })}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={`Lines (${geometry.elements.lines.length})`}
          defaultExpanded={false}
        >
          <LinesPanel
            lines={geometry.elements.lines}
            points={geometry.elements.points}
            onChange={(lines) => updateElements({ lines })}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={`Circles (${geometry.elements.circles.length})`}
          defaultExpanded={false}
        >
          <CirclesPanel
            points={geometry.elements.points}
            circles={geometry.elements.circles}
            onChange={(circles) => updateElements({ circles })}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={`Angles (${geometry.elements.angles.length})`}
          defaultExpanded={false}
        >
          <AnglesPanel
            points={geometry.elements.points}
            angles={geometry.elements.angles}
            onChange={(angles) => updateElements({ angles })}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={`Vectors (${(geometry.elements.vectors || []).length})`}
          defaultExpanded={false}
        >
          <VectorsPanel
            vectors={geometry.elements.vectors || []}
            points={geometry.elements.points}
            onChange={(vectors) => updateElements({ vectors })}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Shapes" defaultExpanded={false}>
          <ShapesPanel
            triangles={geometry.elements.triangles || []}
            rectangles={geometry.elements.rectangles || []}
            points={geometry.elements.points}
            onTrianglesChange={(triangles) => updateElements({ triangles })}
            onRectanglesChange={(rectangles) => updateElements({ rectangles })}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title={`Texts (${(geometry.elements.texts || []).length})`}
          defaultExpanded={false}
        >
          <TextsPanel
            texts={geometry.elements.texts || []}
            onChange={(texts) => updateElements({ texts })}
          />
        </CollapsibleSection>
      </div>

      <div className="graph-editor-canvas">
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
  )
}
