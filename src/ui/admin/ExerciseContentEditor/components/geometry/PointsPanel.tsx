'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { Plus, Trash2 } from 'lucide-react'

type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface PointsPanelProps {
  points: GeoPoint[]
  onChange: (points: GeoPoint[]) => void
}

const nextPointName = (points: GeoPoint[]): string => {
  const names = new Set(points.map((p) => p.name))
  for (let i = 0; i < 26; i++) {
    const name = String.fromCharCode(65 + i)
    if (!names.has(name)) return name
  }
  return `P${points.length + 1}`
}

export const PointsPanel: React.FC<PointsPanelProps> = ({ points, onChange }) => {
  const handleAdd = () => {
    const newPoint: GeoPoint = {
      name: nextPointName(points),
      x: 0,
      y: 0,
      visible: true,
    }
    onChange([...points, newPoint])
  }

  const handleRemove = (index: number) => {
    onChange(points.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<GeoPoint>) => {
    onChange(points.map((p, i) => (i === index ? { ...p, ...updates } : p)))
  }

  return (
    <div className="points-panel">
      <div className="panel-items-list">
        {points.map((point, index) => (
          <div key={index} className="panel-item-row">
            <div className="panel-field">
              <span className="panel-field-label">Name</span>
              <input
                type="text"
                className="panel-field-input"
                value={point.name}
                onChange={(e) => handleUpdate(index, { name: e.target.value })}
                style={{ width: 50 }}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">X</span>
              <input
                type="number"
                className="panel-field-input"
                value={point.x}
                onChange={(e) => handleUpdate(index, { x: Number(e.target.value) })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Y</span>
              <input
                type="number"
                className="panel-field-input"
                value={point.y}
                onChange={(e) => handleUpdate(index, { y: Number(e.target.value) })}
              />
            </div>
            <label className="panel-checkbox-label" style={{ fontSize: '0.75rem' }}>
              <input
                type="checkbox"
                checked={point.visible ?? true}
                onChange={(e) => handleUpdate(index, { visible: e.target.checked })}
              />
              Vis
            </label>
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => handleRemove(index)}
              title="Remove point"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="panel-add-btn" onClick={handleAdd}>
        <Plus size={14} />
        <span>Add Point</span>
      </button>
    </div>
  )
}
