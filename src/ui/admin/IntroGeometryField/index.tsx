'use client'

import React, { useCallback, useMemo } from 'react'
import { useField } from '@payloadcms/ui'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'
import { AnglesPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/AnglesPanel'
import { CanvasConfigPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/CanvasConfigPanel'
import { CirclesPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/CirclesPanel'
import { GeometryCanvasWithToolbar } from '@/ui/admin/ExerciseContentEditor/components/geometry/GeometryCanvasWithToolbar'
import { LinesPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/LinesPanel'
import { PointsPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/PointsPanel'
import { ShapesPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/ShapesPanel'
import { TextsPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/TextsPanel'
import { VectorsPanel } from '@/ui/admin/ExerciseContentEditor/components/geometry/VectorsPanel'

const DEFAULT_SPEC: GeometrySpecV1 = {
  kind: 'euclidean',
  canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
  elements: {
    points: [
      { name: 'A', x: 150, y: 100, position: 'tl', visible: true },
      { name: 'B', x: 350, y: 100, position: 'tr', visible: true },
      { name: 'C', x: 250, y: 300, position: 'b', visible: true },
    ],
    lines: [],
    circles: [],
    angles: [],
  },
  interactionSpec: {
    enabled: false,
    toolsAllowed: [],
    evaluation: { mode: 'none' },
  },
}

export const IntroGeometrySpecField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })

  const geo = useMemo<GeometrySpecV1>(() => {
    if (!value) return DEFAULT_SPEC
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return parsed as GeometrySpecV1
    } catch {
      return DEFAULT_SPEC
    }
  }, [value])

  const persist = useCallback(
    (spec: GeometrySpecV1) => {
      setValue(JSON.stringify(spec, null, 2))
    },
    [setValue],
  )

  const updateGeo = useCallback(
    (updates: Partial<GeometrySpecV1>) => {
      persist({ ...geo, ...updates })
    },
    [geo, persist],
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
      const name = String.fromCharCode(64 + nextIndex)
      updateElements({
        points: [...geo.elements.points, { name, x, y, position: 'r' as const }],
      })
    },
    [geo.elements.points, updateElements],
  )

  const handlePointLabelMoved = useCallback(
    (name: string, position: string) => {
      type PointPosition = GeometrySpecV1['elements']['points'][number]['position']
      const newPoints = geo.elements.points.map((p) =>
        p.name === name ? { ...p, position: position as PointPosition } : p,
      )
      updateElements({ points: newPoints })
    },
    [geo.elements.points, updateElements],
  )

  const handleGridToggle = useCallback(
    (showGrid: boolean) => {
      updateGeo({ canvas: { ...geo.canvas, grid: showGrid } })
    },
    [geo.canvas, updateGeo],
  )

  const handleTextMoved = useCallback(
    (index: number, x: number, y: number) => {
      const newTexts = (geo.elements.texts || []).map((t, i) =>
        i === index ? { ...t, place: { ...t.place, x, y } } : t,
      )
      updateElements({ texts: newTexts })
    },
    [geo.elements.texts, updateElements],
  )

  // Initialize with default spec if empty
  React.useEffect(() => {
    if (!value) {
      setValue(JSON.stringify(DEFAULT_SPEC, null, 2))
    }
  }, [value, setValue])

  return (
    <div className="geometry-editor">
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
        Geometry Spec
      </label>

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
            id={`intro-geo-canvas-${path}`}
            geometry={geo}
            onPointMoved={handlePointMoved}
            onMultiPointMoved={handleMultiPointMoved}
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
