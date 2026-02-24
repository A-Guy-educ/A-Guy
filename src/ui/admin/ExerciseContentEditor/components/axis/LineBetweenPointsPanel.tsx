'use client'

import React from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { Plus, Trash2 } from 'lucide-react'

type LineBetween = NonNullable<AxisSpecV1['elements']['lineBetweenPoints']>[number]

interface LineBetweenPointsPanelProps {
  lines: LineBetween[]
  onChange: (lines: LineBetween[]) => void
}

export const LineBetweenPointsPanel: React.FC<LineBetweenPointsPanelProps> = ({
  lines,
  onChange,
}) => {
  const handleAdd = () => {
    const newLine: LineBetween = {
      style: 'solid',
      thickness: 2,
      a: { x: 0, y: 0 },
      b: { x: 5, y: 5 },
    }
    onChange([...lines, newLine])
  }

  const handleRemove = (index: number) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<LineBetween>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...updates } : l)))
  }

  return (
    <div className="line-between-panel">
      <div className="panel-items-list">
        {lines.map((line, index) => (
          <div key={index} className="panel-item-row" style={{ flexWrap: 'wrap' }}>
            <div className="panel-field">
              <span className="panel-field-label">A(x)</span>
              <input
                type="number"
                className="panel-field-input"
                value={line.a.x}
                onChange={(e) =>
                  handleUpdate(index, { a: { ...line.a, x: Number(e.target.value) } })
                }
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">A(y)</span>
              <input
                type="number"
                className="panel-field-input"
                value={line.a.y}
                onChange={(e) =>
                  handleUpdate(index, { a: { ...line.a, y: Number(e.target.value) } })
                }
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">B(x)</span>
              <input
                type="number"
                className="panel-field-input"
                value={line.b.x}
                onChange={(e) =>
                  handleUpdate(index, { b: { ...line.b, x: Number(e.target.value) } })
                }
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">B(y)</span>
              <input
                type="number"
                className="panel-field-input"
                value={line.b.y}
                onChange={(e) =>
                  handleUpdate(index, { b: { ...line.b, y: Number(e.target.value) } })
                }
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Style</span>
              <select
                className="panel-field-select"
                value={line.style}
                onChange={(e) =>
                  handleUpdate(index, { style: e.target.value as LineBetween['style'] })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <button type="button" className="panel-remove-btn" onClick={() => handleRemove(index)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="panel-add-btn" onClick={handleAdd}>
        <Plus size={14} />
        <span>Add Line</span>
      </button>
    </div>
  )
}
