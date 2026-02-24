'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { Plus, Trash2 } from 'lucide-react'

type GeoVector = NonNullable<GeometrySpecV1['elements']['vectors']>[number]
type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface VectorsPanelProps {
  vectors: GeoVector[]
  points: GeoPoint[]
  onChange: (vectors: GeoVector[]) => void
}

export const VectorsPanel: React.FC<VectorsPanelProps> = ({ vectors, points, onChange }) => {
  const handleAdd = () => {
    const newVec: GeoVector = {
      from: points[0]?.name || '',
      to: points[1]?.name || points[0]?.name || '',
    }
    onChange([...vectors, newVec])
  }

  const handleRemove = (index: number) => {
    onChange(vectors.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<GeoVector>) => {
    onChange(vectors.map((v, i) => (i === index ? { ...v, ...updates } : v)))
  }

  return (
    <div className="vectors-panel">
      <div className="panel-items-list">
        {vectors.map((vec, index) => (
          <div key={index} className="panel-item-row">
            <div className="panel-field">
              <span className="panel-field-label">From</span>
              <select
                className="panel-field-select"
                value={vec.from}
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
                value={vec.to}
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
              <span className="panel-field-label">Color</span>
              <input
                type="color"
                className="panel-color-input"
                value={vec.color || '#000000'}
                onChange={(e) => handleUpdate(index, { color: e.target.value })}
              />
            </div>
            <button type="button" className="panel-remove-btn" onClick={() => handleRemove(index)}>
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
        <span>Add Vector</span>
      </button>
    </div>
  )
}
