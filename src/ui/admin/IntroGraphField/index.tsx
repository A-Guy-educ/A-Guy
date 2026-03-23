'use client'

import React, { useCallback, useMemo } from 'react'
import { useField } from '@payloadcms/ui'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'
import { AxisCanvas } from '@/ui/admin/ExerciseContentEditor/components/axis/AxisCanvas'
import { AxisConfigPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/AxisConfigPanel'
import { AxisPointsPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/AxisPointsPanel'
import { GraphsPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/GraphsPanel'
import { AsymptotesPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/AsymptotesPanel'
import { LineBetweenPointsPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/LineBetweenPointsPanel'
import { PaintPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/PaintPanel'
import { LociPanel } from '@/ui/admin/ExerciseContentEditor/components/axis/LociPanel'

const DEFAULT_SPEC: AxisSpecV1 = {
  kind: 'cartesian',
  units: 1,
  grid: { enabled: true, color: '#e0e0e0' },
  axes: {
    showNumbers: true,
    showLabels: true,
    ticks: 1,
    labels: { x: 'x', y: 'y' },
    origin: { x: 0, y: 0 },
  },
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  elements: { points: [], graphs: [] },
}

export const IntroGraphSpecField: React.FC<{ path: string }> = ({ path }) => {
  const { value, setValue } = useField<string>({ path })

  const spec = useMemo<AxisSpecV1>(() => {
    if (!value) return DEFAULT_SPEC
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return parsed as AxisSpecV1
    } catch {
      return DEFAULT_SPEC
    }
  }, [value])

  const persist = useCallback(
    (s: AxisSpecV1) => {
      setValue(JSON.stringify(s, null, 2))
    },
    [setValue],
  )

  const updateAxis = useCallback(
    (updates: Partial<AxisSpecV1>) => {
      persist({ ...spec, ...updates })
    },
    [spec, persist],
  )

  const updateElements = useCallback(
    (updates: Partial<AxisSpecV1['elements']>) => {
      updateAxis({ elements: { ...spec.elements, ...updates } })
    },
    [spec, updateAxis],
  )

  const handlePointMoved = useCallback(
    (index: number, x: number, y: number) => {
      const newPoints = spec.elements.points.map((p, i) => (i === index ? { ...p, x, y } : p))
      updateElements({ points: newPoints })
    },
    [spec.elements.points, updateElements],
  )

  // Initialize with default spec if empty
  React.useEffect(() => {
    if (!value) {
      setValue(JSON.stringify(DEFAULT_SPEC, null, 2))
    }
  }, [value, setValue])

  return (
    <div className="axis-editor">
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
        Graph Spec
      </label>

      <div className="question-editor-section">
        <div className="graph-editor-layout">
          <div className="graph-editor-form">
            <CollapsibleSection title="Configuration" defaultExpanded={false}>
              <AxisConfigPanel spec={spec} onChange={(s) => persist(s)} />
            </CollapsibleSection>

            <CollapsibleSection title={`Graphs (${spec.elements.graphs.length})`} defaultExpanded>
              <GraphsPanel
                graphs={spec.elements.graphs}
                onChange={(graphs) => updateElements({ graphs })}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={`Points (${spec.elements.points.length})`}
              defaultExpanded={false}
            >
              <AxisPointsPanel
                points={spec.elements.points}
                onChange={(points) => updateElements({ points })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Asymptotes" defaultExpanded={false}>
              <AsymptotesPanel
                vertical={spec.elements.asymptotesVertical || []}
                horizontal={spec.elements.asymptotesHorizontal || []}
                onVerticalChange={(v) => updateElements({ asymptotesVertical: v })}
                onHorizontalChange={(h) => updateElements({ asymptotesHorizontal: h })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Lines Between Points" defaultExpanded={false}>
              <LineBetweenPointsPanel
                lines={spec.elements.lineBetweenPoints || []}
                onChange={(lines) => updateElements({ lineBetweenPoints: lines })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Paint / Shading" defaultExpanded={false}>
              <PaintPanel
                graphs={spec.elements.graphs}
                paintBetweenGraphs={spec.elements.paintBetweenGraphs || []}
                onGraphsChange={(graphs) => updateElements({ graphs })}
                onPaintBetweenChange={(items) => updateElements({ paintBetweenGraphs: items })}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Geometric Loci" defaultExpanded={false}>
              <LociPanel
                loci={spec.elements.geometricLoci || []}
                onChange={(loci) => updateElements({ geometricLoci: loci })}
              />
            </CollapsibleSection>
          </div>

          <div className="graph-editor-canvas">
            <AxisCanvas
              id={`intro-axis-canvas-${path}`}
              axis={spec}
              onPointMoved={handlePointMoved}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
