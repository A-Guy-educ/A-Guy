'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { Plus, Trash2 } from 'lucide-react'

type GeoLine = GeometrySpecV1['elements']['lines'][number]
type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface LinesPanelProps {
  lines: GeoLine[]
  points: GeoPoint[]
  onChange: (lines: GeoLine[]) => void
}

export const LinesPanel: React.FC<LinesPanelProps> = ({ lines, points, onChange }) => {
  const handleAdd = () => {
    const from = points[0]?.name || ''
    const to = points[1]?.name || points[0]?.name || ''
    const newLine: GeoLine = { from, to, style: 'solid' }
    onChange([...lines, newLine])
  }

  const handleRemove = (index: number) => {
    onChange(lines.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<GeoLine>) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...updates } : l)))
  }

  return (
    <div className="lines-panel">
      <div className="panel-items-list">
        {lines.map((line, index) => (
          <div key={index} className="panel-item-row">
            <div className="panel-field">
              <span className="panel-field-label">From</span>
              <select
                className="panel-field-select"
                value={line.from}
                onChange={(e) => handleUpdate(index, { from: e.target.value })}
              >
                {points.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">To</span>
              <select
                className="panel-field-select"
                value={line.to}
                onChange={(e) => handleUpdate(index, { to: e.target.value })}
              >
                {points.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Style</span>
              <select
                className="panel-field-select"
                value={line.style}
                onChange={(e) =>
                  handleUpdate(index, { style: e.target.value as 'solid' | 'dashed' })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Color</span>
              <input
                type="color"
                className="panel-color-input"
                value={line.color || '#000000'}
                onChange={(e) => handleUpdate(index, { color: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => handleRemove(index)}
              title="Remove line"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="panel-add-btn"
        onClick={handleAdd}
        disabled={points.length < 2}
      >
        <Plus size={14} />
        <span>Add Line</span>
      </button>
    </div>
  )
}
