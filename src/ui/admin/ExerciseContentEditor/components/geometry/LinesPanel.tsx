'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { getDefaultTextColor } from '@/infra/contracts/graphics/textColors'
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
                value={line.color || getDefaultTextColor()}
                onChange={(e) => handleUpdate(index, { color: e.target.value })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Label</span>
              <input
                type="text"
                className="panel-field-input panel-field-input--short"
                value={line.label?.value || ''}
                placeholder="e.g. 5cm"
                onChange={(e) =>
                  handleUpdate(index, {
                    label: { position: line.label?.position || 't', value: e.target.value },
                  })
                }
              />
            </div>
            {line.label?.value && (
              <div className="panel-field">
                <span className="panel-field-label">Label Pos</span>
                <select
                  className="panel-field-select"
                  value={line.label?.position || 't'}
                  onChange={(e) =>
                    handleUpdate(index, {
                      label: {
                        ...line.label,
                        value: line.label?.value || '',
                        position: e.target.value as 't' | 'b' | 'm',
                      },
                    })
                  }
                >
                  <option value="t">Above</option>
                  <option value="m">On line</option>
                  <option value="b">Below</option>
                </select>
              </div>
            )}
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
