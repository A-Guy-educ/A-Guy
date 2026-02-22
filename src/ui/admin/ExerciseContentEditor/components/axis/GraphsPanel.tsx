'use client'

import React from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { generateId } from '@/server/payload/collections/Exercises/types'
import { Plus, Trash2 } from 'lucide-react'

type AxisGraph = AxisSpecV1['elements']['graphs'][number]

interface GraphsPanelProps {
  graphs: AxisGraph[]
  onChange: (graphs: AxisGraph[]) => void
}

export const GraphsPanel: React.FC<GraphsPanelProps> = ({ graphs, onChange }) => {
  const handleAdd = () => {
    const newGraph: AxisGraph = {
      id: generateId(),
      fn: 'x',
      style: 'solid',
      thickness: 2,
      color: '#3366cc',
    }
    onChange([...graphs, newGraph])
  }

  const handleRemove = (index: number) => {
    onChange(graphs.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<AxisGraph>) => {
    onChange(graphs.map((g, i) => (i === index ? { ...g, ...updates } : g)))
  }

  return (
    <div className="graphs-panel">
      <div className="panel-items-list">
        {graphs.map((graph, index) => (
          <div key={graph.id} className="panel-item-row" style={{ flexWrap: 'wrap' }}>
            <div className="panel-field" style={{ flex: 1, minWidth: 120 }}>
              <span className="panel-field-label">Function f(x)</span>
              <input
                type="text"
                className="panel-field-input panel-field-input--wide"
                value={graph.fn}
                onChange={(e) => handleUpdate(index, { fn: e.target.value })}
                placeholder="e.g. x^2, 2*x+1, sin(x)"
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Style</span>
              <select
                className="panel-field-select"
                value={graph.style}
                onChange={(e) =>
                  handleUpdate(index, { style: e.target.value as AxisGraph['style'] })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Width</span>
              <input
                type="number"
                className="panel-field-input"
                value={graph.thickness}
                min={1}
                max={10}
                style={{ width: 50 }}
                onChange={(e) => handleUpdate(index, { thickness: Number(e.target.value) || 2 })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Color</span>
              <input
                type="color"
                className="panel-color-input"
                value={graph.color || '#3366cc'}
                onChange={(e) => handleUpdate(index, { color: e.target.value })}
              />
            </div>
            <button type="button" className="panel-remove-btn" onClick={() => handleRemove(index)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="panel-add-btn" onClick={handleAdd}>
        <Plus size={14} />
        <span>Add Graph</span>
      </button>
    </div>
  )
}
