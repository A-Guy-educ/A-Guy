'use client'

import React, { useCallback } from 'react'
import type { QuestionGeometryBlock } from '@/server/payload/collections/Exercises/types'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { GeometryCanvasWithToolbar } from '../components/geometry/GeometryCanvasWithToolbar'
import { CanvasConfigPanel } from '../components/geometry/CanvasConfigPanel'
import { PointsPanel } from '../components/geometry/PointsPanel'
import { LinesPanel } from '../components/geometry/LinesPanel'
import { CirclesPanel } from '../components/geometry/CirclesPanel'
import { AnglesPanel } from '../components/geometry/AnglesPanel'
import { ShapesPanel } from '../components/geometry/ShapesPanel'
import { VectorsPanel } from '../components/geometry/VectorsPanel'
import { TextsPanel } from '../components/geometry/TextsPanel'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'

interface GeometryEditorProps {
  block: QuestionGeometryBlock
  onChange: (block: QuestionGeometryBlock) => void
}

export const GeometryEditor: React.FC<GeometryEditorProps> = ({ block, onChange }) => {
  const geo = block.geometry

  const updateGeo = useCallback(
    (updates: Partial<GeometrySpecV1>) => {
      onChange({ ...block, geometry: { ...geo, ...updates } })
    },
    [block, geo, onChange],
  )

  const updateElements = useCallback(
    (updates: Partial<GeometrySpecV1['elements']>) => {
      updateGeo({ elements: { ...geo.elements, ...updates } })
    },
    [geo, updateGeo],
  )

  const handlePointMoved = useCallback(
    (name: string, x: number, y: number) => {
      const newPoints = geo.elements.points.map((p) => (p.name === name ? { ...p, x, y } : p))
      updateElements({ points: newPoints })
    },
    [geo.elements.points, updateElements],
  )

  const handleMultiPointMoved = useCallback(
    (updates: Array<{ name: string; x: number; y: number }>) => {
      const map = new Map(updates.map((u) => [u.name, u]))
      const newPoints = geo.elements.points.map((p) => {
        const u = map.get(p.name)
        return u ? { ...p, x: u.x, y: u.y } : p
      })
      updateElements({ points: newPoints })
    },
    [geo.elements.points, updateElements],
  )

  const handlePointAdded = useCallback(
    (x: number, y: number) => {
      const nextIndex = geo.elements.points.length + 1
      const name = String.fromCharCode(64 + nextIndex) // A, B, C, ...
      updateElements({ points: [...geo.elements.points, { name, x, y }] })
    },
    [geo.elements.points, updateElements],
  )

  const handleGridToggle = useCallback(
    (showGrid: boolean) => {
      updateGeo({ canvas: { ...geo.canvas, grid: showGrid } })
    },
    [geo.canvas, updateGeo],
  )

  return (
    <div className="geometry-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(prompt) => onChange({ ...block, prompt })}
          placeholder="Enter your geometry question..."
        />
      </div>

      <div className="question-editor-section">
        <div className="graph-editor-layout">
          <div className="graph-editor-form">
            <CollapsibleSection title="Canvas" defaultExpanded={false}>
              <CanvasConfigPanel canvas={geo.canvas} onChange={(canvas) => updateGeo({ canvas })} />
            </CollapsibleSection>

            <CollapsibleSection title={`Points (${geo.elements.points.length})`} defaultExpanded>
              <PointsPanel
                points={geo.elements.points}
                onChange={(points) => updateElements({ points })}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`Lines (${geo.elements.lines.length})`}
              defaultExpanded={false}
            >
              <LinesPanel
                lines={geo.elements.lines}
                points={geo.elements.points}
                onChange={(lines) => updateElements({ lines })}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`Circles (${geo.elements.circles.length})`}
              defaultExpanded={false}
            >
              <CirclesPanel
                circles={geo.elements.circles}
                points={geo.elements.points}
                onChange={(circles) => updateElements({ circles })}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`Angles (${geo.elements.angles.length})`}
              defaultExpanded={false}
            >
              <AnglesPanel
                angles={geo.elements.angles}
                points={geo.elements.points}
                onChange={(angles) => updateElements({ angles })}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`Vectors (${(geo.elements.vectors || []).length})`}
              defaultExpanded={false}
            >
              <VectorsPanel
                vectors={geo.elements.vectors || []}
                points={geo.elements.points}
                onChange={(vectors) => updateElements({ vectors })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Shapes" defaultExpanded={false}>
              <ShapesPanel
                triangles={geo.elements.triangles || []}
                rectangles={geo.elements.rectangles || []}
                points={geo.elements.points}
                onTrianglesChange={(triangles) => updateElements({ triangles })}
                onRectanglesChange={(rectangles) => updateElements({ rectangles })}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`Texts (${(geo.elements.texts || []).length})`}
              defaultExpanded={false}
            >
              <TextsPanel
                texts={geo.elements.texts || []}
                onChange={(texts) => updateElements({ texts })}
              />
            </CollapsibleSection>
          </div>

          <GeometryCanvasWithToolbar
            id={`geo-canvas-${block.id}`}
            geometry={geo}
            onPointMoved={handlePointMoved}
            onMultiPointMoved={handleMultiPointMoved}
            onPointAdded={handlePointAdded}
            onGridToggle={handleGridToggle}
          />
        </div>
      </div>
    </div>
  )
}
