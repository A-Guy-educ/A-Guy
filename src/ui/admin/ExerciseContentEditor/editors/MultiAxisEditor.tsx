'use client'

import React, { useCallback } from 'react'
import type {
  QuestionMultiAxisBlock,
  MultiAxisGraphItem,
} from '@/server/payload/collections/Exercises/types'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { generateId } from '@/server/payload/collections/Exercises/defaults'
import { CollapsibleSection } from '@/ui/admin/shared/CollapsibleSection'
import { AxisCanvas } from '../components/axis/AxisCanvas'
import { AxisConfigPanel } from '../components/axis/AxisConfigPanel'
import { GraphsPanel } from '../components/axis/GraphsPanel'
import { AxisPointsPanel } from '../components/axis/AxisPointsPanel'
import { AsymptotesPanel } from '../components/axis/AsymptotesPanel'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { Plus, Trash2 } from 'lucide-react'

interface MultiAxisEditorProps {
  block: QuestionMultiAxisBlock
  onChange: (block: QuestionMultiAxisBlock) => void
}

const DEFAULT_AXIS: AxisSpecV1 = {
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

export const MultiAxisEditor: React.FC<MultiAxisEditorProps> = ({ block, onChange }) => {
  const updateGraph = useCallback(
    (graphId: string, updates: Partial<MultiAxisGraphItem>) => {
      onChange({
        ...block,
        graphs: block.graphs.map((g) => (g.id === graphId ? { ...g, ...updates } : g)),
      })
    },
    [block, onChange],
  )

  const updateGraphAxis = useCallback(
    (graphId: string, axisUpdates: Partial<AxisSpecV1>) => {
      onChange({
        ...block,
        graphs: block.graphs.map((g) =>
          g.id === graphId ? { ...g, axis: { ...g.axis, ...axisUpdates } } : g,
        ),
      })
    },
    [block, onChange],
  )

  const updateGraphElements = useCallback(
    (graphId: string, elementUpdates: Partial<AxisSpecV1['elements']>) => {
      const graph = block.graphs.find((g) => g.id === graphId)
      if (!graph) return
      updateGraphAxis(graphId, { elements: { ...graph.axis.elements, ...elementUpdates } })
    },
    [block.graphs, updateGraphAxis],
  )

  const handleAddGraph = useCallback(() => {
    if (block.graphs.length >= 4) return
    const newGraph: MultiAxisGraphItem = {
      id: generateId(),
      label: `Graph ${block.graphs.length + 1}`,
      axis: { ...DEFAULT_AXIS },
      order: block.graphs.length,
    }
    onChange({ ...block, graphs: [...block.graphs, newGraph] })
  }, [block, onChange])

  const handleRemoveGraph = useCallback(
    (graphId: string) => {
      if (block.graphs.length <= 1) return
      const remaining = block.graphs
        .filter((g) => g.id !== graphId)
        .map((g, i) => ({ ...g, order: i }))
      onChange({ ...block, graphs: remaining })
    },
    [block, onChange],
  )

  const handlePointMoved = useCallback(
    (graphId: string, index: number, x: number, y: number) => {
      const graph = block.graphs.find((g) => g.id === graphId)
      if (!graph) return
      const newPoints = graph.axis.elements.points.map((p, i) => (i === index ? { ...p, x, y } : p))
      updateGraphElements(graphId, { points: newPoints })
    },
    [block.graphs, updateGraphElements],
  )

  return (
    <div className="multi-axis-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt (optional)</label>
        <InlineRichTextEditor
          value={
            block.prompt ?? { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] }
          }
          onChange={(prompt) => onChange({ ...block, prompt })}
          placeholder="Enter an optional prompt for the multi-graph block..."
        />
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Text Position</label>
        <select
          className="panel-field-select"
          value={block.textPosition || 'above'}
          onChange={(e) =>
            onChange({ ...block, textPosition: e.target.value as 'above' | 'below' })
          }
        >
          <option value="above">Above Graphs</option>
          <option value="below">Below Graphs</option>
        </select>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Columns Per Row</label>
        <select
          className="panel-field-select"
          value={block.columnsPerRow ?? 2}
          onChange={(e) =>
            onChange({ ...block, columnsPerRow: Number(e.target.value) as 1 | 2 | 4 })
          }
        >
          <option value={1}>1 per row</option>
          <option value={2}>2 per row</option>
          <option value={4}>4 per row</option>
        </select>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Graphs ({block.graphs.length}/4)</label>

        {block.graphs.map((graph, idx) => (
          <CollapsibleSection
            key={graph.id}
            title={`${graph.label || `Graph ${idx + 1}`}`}
            defaultExpanded={idx === 0}
          >
            <div className="panel-item-row" style={{ marginBottom: 8 }}>
              <div className="panel-field">
                <span className="panel-field-label">Label</span>
                <input
                  type="text"
                  className="panel-field-input"
                  value={graph.label}
                  onChange={(e) => updateGraph(graph.id, { label: e.target.value })}
                />
              </div>
              {block.graphs.length > 1 && (
                <button
                  type="button"
                  className="panel-remove-btn"
                  onClick={() => handleRemoveGraph(graph.id)}
                  title="Remove graph"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="graph-editor-layout">
              <div className="graph-editor-form">
                <CollapsibleSection title="Configuration" defaultExpanded={false}>
                  <AxisConfigPanel
                    spec={graph.axis}
                    onChange={(s) => updateGraph(graph.id, { axis: s })}
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title={`Graphs (${graph.axis.elements.graphs.length})`}
                  defaultExpanded
                >
                  <GraphsPanel
                    graphs={graph.axis.elements.graphs}
                    onChange={(graphs) => updateGraphElements(graph.id, { graphs })}
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title={`Points (${graph.axis.elements.points.length})`}
                  defaultExpanded={false}
                >
                  <AxisPointsPanel
                    points={graph.axis.elements.points}
                    onChange={(points) => updateGraphElements(graph.id, { points })}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Asymptotes" defaultExpanded={false}>
                  <AsymptotesPanel
                    vertical={graph.axis.elements.asymptotesVertical || []}
                    horizontal={graph.axis.elements.asymptotesHorizontal || []}
                    onVerticalChange={(v) =>
                      updateGraphElements(graph.id, { asymptotesVertical: v })
                    }
                    onHorizontalChange={(h) =>
                      updateGraphElements(graph.id, { asymptotesHorizontal: h })
                    }
                  />
                </CollapsibleSection>
              </div>

              <div className="graph-editor-canvas">
                <AxisCanvas
                  id={`multi-axis-canvas-${graph.id}`}
                  axis={graph.axis}
                  onPointMoved={(index, x, y) => handlePointMoved(graph.id, index, x, y)}
                />
              </div>
            </div>
          </CollapsibleSection>
        ))}

        <button
          type="button"
          className="panel-add-btn"
          onClick={handleAddGraph}
          disabled={block.graphs.length >= 4}
          style={{ marginTop: 8 }}
        >
          <Plus size={14} />
          <span>Add Graph ({block.graphs.length}/4)</span>
        </button>
      </div>
    </div>
  )
}
