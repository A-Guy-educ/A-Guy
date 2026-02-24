'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { Plus, Trash2 } from 'lucide-react'

type GeoCircle = GeometrySpecV1['elements']['circles'][number]
type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface CirclesPanelProps {
  circles: GeoCircle[]
  points: GeoPoint[]
  onChange: (circles: GeoCircle[]) => void
}

export const CirclesPanel: React.FC<CirclesPanelProps> = ({ circles, points, onChange }) => {
  const handleAdd = () => {
    const center = points[0]?.name || ''
    const newCircle: GeoCircle = { center, radius: 50, style: 'solid' }
    onChange([...circles, newCircle])
  }

  const handleRemove = (index: number) => {
    onChange(circles.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<GeoCircle>) => {
    onChange(circles.map((c, i) => (i === index ? { ...c, ...updates } : c)))
  }

  return (
    <div className="circles-panel">
      <div className="panel-items-list">
        {circles.map((circle, index) => (
          <div key={index} className="panel-item-row">
            <div className="panel-field">
              <span className="panel-field-label">Center</span>
              <select
                className="panel-field-select"
                value={circle.center}
                onChange={(e) => handleUpdate(index, { center: e.target.value })}
              >
                {points.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Through</span>
              <select
                className="panel-field-select"
                value={circle.through || ''}
                onChange={(e) =>
                  handleUpdate(index, {
                    through: e.target.value || undefined,
                    radius: e.target.value ? undefined : circle.radius,
                  })
                }
              >
                <option value="">— Use radius —</option>
                {points.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {!circle.through && (
              <div className="panel-field">
                <span className="panel-field-label">Radius</span>
                <input
                  type="number"
                  className="panel-field-input"
                  value={circle.radius ?? 50}
                  onChange={(e) => handleUpdate(index, { radius: Number(e.target.value) || 50 })}
                  min={1}
                />
              </div>
            )}
            <div className="panel-field">
              <span className="panel-field-label">Style</span>
              <select
                className="panel-field-select"
                value={circle.style}
                onChange={(e) =>
                  handleUpdate(index, { style: e.target.value as 'solid' | 'dashed' })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </div>
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => handleRemove(index)}
              title="Remove circle"
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
        disabled={points.length < 1}
      >
        <Plus size={14} />
        <span>Add Circle</span>
      </button>
    </div>
  )
}
