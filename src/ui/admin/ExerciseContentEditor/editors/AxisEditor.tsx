'use client'

import React, { useCallback } from 'react'
import type { QuestionAxisBlock } from '@/server/payload/collections/Exercises/types'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { AxisCanvas } from '../components/axis/AxisCanvas'
import { AxisConfigPanel } from '../components/axis/AxisConfigPanel'
import { AxisPointsPanel } from '../components/axis/AxisPointsPanel'
import { GraphsPanel } from '../components/axis/GraphsPanel'
import { AsymptotesPanel } from '../components/axis/AsymptotesPanel'
import { LineBetweenPointsPanel } from '../components/axis/LineBetweenPointsPanel'
import { PaintPanel } from '../components/axis/PaintPanel'
import { LociPanel } from '../components/axis/LociPanel'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'

interface AxisEditorProps {
  block: QuestionAxisBlock
  onChange: (block: QuestionAxisBlock) => void
}

export const AxisEditor: React.FC<AxisEditorProps> = ({ block, onChange }) => {
  const spec = block.axis

  const updateAxis = useCallback(
    (updates: Partial<AxisSpecV1>) => {
      onChange({ ...block, axis: { ...spec, ...updates } })
    },
    [block, spec, onChange],
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

  return (
    <div className="axis-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(prompt) => onChange({ ...block, prompt })}
          placeholder="Enter your axis/graph question..."
        />
      </div>

      <div className="question-editor-section">
        <div className="graph-editor-layout">
          <div className="graph-editor-form">
            <CollapsibleSection title="Configuration" defaultExpanded={false}>
              <AxisConfigPanel spec={spec} onChange={(s) => onChange({ ...block, axis: s })} />
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
              id={`axis-canvas-${block.id}`}
              axis={spec}
              onPointMoved={handlePointMoved}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
