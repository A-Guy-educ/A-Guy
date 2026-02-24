'use client'

import React from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { Plus, Trash2 } from 'lucide-react'

type Graph = AxisSpecV1['elements']['graphs'][number]
type PaintRange = NonNullable<NonNullable<Graph['paint']>['integral']>[number]
type PaintBetween = NonNullable<AxisSpecV1['elements']['paintBetweenGraphs']>[number]

interface PaintPanelProps {
  graphs: Graph[]
  paintBetweenGraphs: PaintBetween[]
  onGraphsChange: (graphs: Graph[]) => void
  onPaintBetweenChange: (items: PaintBetween[]) => void
}

export const PaintPanel: React.FC<PaintPanelProps> = ({
  graphs,
  paintBetweenGraphs,
  onGraphsChange,
  onPaintBetweenChange,
}) => {
  const updateGraphPaint = (
    gIdx: number,
    kind: 'integral' | 'underGraph' | 'aboveGraph',
    ranges: PaintRange[],
  ) => {
    const updated = graphs.map((g, i) =>
      i === gIdx ? { ...g, paint: { ...g.paint, [kind]: ranges } } : g,
    )
    onGraphsChange(updated)
  }

  const addRange = (gIdx: number, kind: 'integral' | 'underGraph' | 'aboveGraph') => {
    const g = graphs[gIdx]
    const existing = g.paint?.[kind] || []
    updateGraphPaint(gIdx, kind, [...existing, { fromX: 0, toX: 5 }])
  }

  const removeRange = (
    gIdx: number,
    kind: 'integral' | 'underGraph' | 'aboveGraph',
    rIdx: number,
  ) => {
    const existing = graphs[gIdx].paint?.[kind] || []
    updateGraphPaint(
      gIdx,
      kind,
      existing.filter((_, i) => i !== rIdx),
    )
  }

  const updateRange = (
    gIdx: number,
    kind: 'integral' | 'underGraph' | 'aboveGraph',
    rIdx: number,
    updates: Partial<PaintRange>,
  ) => {
    const existing = graphs[gIdx].paint?.[kind] || []
    updateGraphPaint(
      gIdx,
      kind,
      existing.map((r, i) => (i === rIdx ? { ...r, ...updates } : r)),
    )
  }

  const renderRanges = (
    gIdx: number,
    kind: 'integral' | 'underGraph' | 'aboveGraph',
    label: string,
  ) => {
    const ranges = graphs[gIdx].paint?.[kind] || []
    return (
      <div style={{ marginLeft: 12, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{label}</span>
          <button
            type="button"
            className="panel-add-btn"
            style={{ padding: '1px 6px', fontSize: '0.65rem' }}
            onClick={() => addRange(gIdx, kind)}
          >
            <Plus size={10} />
            <span>Add</span>
          </button>
        </div>
        {ranges.map((r, rIdx) => (
          <div key={rIdx} className="panel-item-row" style={{ gap: 4, paddingBlock: 2 }}>
            <div className="panel-field">
              <span className="panel-field-label">From X</span>
              <input
                type="number"
                className="panel-field-input"
                value={r.fromX}
                onChange={(e) => updateRange(gIdx, kind, rIdx, { fromX: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">To X</span>
              <input
                type="number"
                className="panel-field-input"
                value={r.toX}
                onChange={(e) => updateRange(gIdx, kind, rIdx, { toX: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Color</span>
              <input
                type="color"
                value={r.fillColor || '#3366cc'}
                style={{ width: 28, height: 24 }}
                onChange={(e) => updateRange(gIdx, kind, rIdx, { fillColor: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => removeRange(gIdx, kind, rIdx)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="paint-panel">
      {graphs.length === 0 && (
        <p style={{ color: '#999', fontSize: '0.8rem' }}>
          Add graphs first to configure paint ranges.
        </p>
      )}
      {graphs.map((g, gIdx) => (
        <div
          key={g.id}
          style={{ marginBottom: 8, borderBottom: '1px solid #eee', paddingBottom: 6 }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            Graph: {g.fn || `#${gIdx + 1}`}
          </span>
          {renderRanges(gIdx, 'integral', 'Integral')}
          {renderRanges(gIdx, 'underGraph', 'Under Graph')}
          {renderRanges(gIdx, 'aboveGraph', 'Above Graph')}
        </div>
      ))}

      <div style={{ marginTop: 8 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
          Paint Between Graphs
        </span>
        <div className="panel-items-list">
          {paintBetweenGraphs.map((pb, index) => (
            <div key={index} className="panel-item-row" style={{ flexWrap: 'wrap' }}>
              <div className="panel-field">
                <span className="panel-field-label">Graph 1</span>
                <select
                  className="panel-field-select"
                  value={pb.firstGraphId}
                  onChange={(e) =>
                    onPaintBetweenChange(
                      paintBetweenGraphs.map((p, i) =>
                        i === index ? { ...p, firstGraphId: e.target.value } : p,
                      ),
                    )
                  }
                >
                  <option value="">Select</option>
                  {graphs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fn || g.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="panel-field">
                <span className="panel-field-label">Graph 2</span>
                <select
                  className="panel-field-select"
                  value={pb.secondGraphId}
                  onChange={(e) =>
                    onPaintBetweenChange(
                      paintBetweenGraphs.map((p, i) =>
                        i === index ? { ...p, secondGraphId: e.target.value } : p,
                      ),
                    )
                  }
                >
                  <option value="">Select</option>
                  {graphs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fn || g.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="panel-field">
                <span className="panel-field-label">From X</span>
                <input
                  type="number"
                  className="panel-field-input"
                  value={pb.fromX}
                  onChange={(e) =>
                    onPaintBetweenChange(
                      paintBetweenGraphs.map((p, i) =>
                        i === index ? { ...p, fromX: Number(e.target.value) } : p,
                      ),
                    )
                  }
                />
              </div>
              <div className="panel-field">
                <span className="panel-field-label">To X</span>
                <input
                  type="number"
                  className="panel-field-input"
                  value={pb.toX}
                  onChange={(e) =>
                    onPaintBetweenChange(
                      paintBetweenGraphs.map((p, i) =>
                        i === index ? { ...p, toX: Number(e.target.value) } : p,
                      ),
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="panel-remove-btn"
                onClick={() =>
                  onPaintBetweenChange(paintBetweenGraphs.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="panel-add-btn"
          onClick={() =>
            onPaintBetweenChange([
              ...paintBetweenGraphs,
              { firstGraphId: '', secondGraphId: '', fromX: 0, toX: 5 },
            ])
          }
        >
          <Plus size={14} />
          <span>Add Paint Between</span>
        </button>
      </div>
    </div>
  )
}
