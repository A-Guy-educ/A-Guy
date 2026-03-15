'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { getDefaultAngleColor } from '@/infra/contracts/graphics/textColors'
import { Plus, Trash2 } from 'lucide-react'

type GeoAngle = GeometrySpecV1['elements']['angles'][number]
type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface AnglesPanelProps {
  angles: GeoAngle[]
  points: GeoPoint[]
  onChange: (angles: GeoAngle[]) => void
}

export const AnglesPanel: React.FC<AnglesPanelProps> = ({ angles, points, onChange }) => {
  const handleAdd = () => {
    const names = points.map((p) => p.name)
    const newAngle: GeoAngle = {
      center: names[1] || names[0] || '',
      ray1: names[0] || '',
      ray2: names[2] || names[0] || '',
    }
    onChange([...angles, newAngle])
  }

  const handleRemove = (index: number) => {
    onChange(angles.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<GeoAngle>) => {
    onChange(angles.map((a, i) => (i === index ? { ...a, ...updates } : a)))
  }

  return (
    <div className="angles-panel">
      <div className="panel-items-list">
        {angles.map((angle, index) => (
          <div key={index} className="panel-item-row">
            <div className="panel-field">
              <span className="panel-field-label">Ray1</span>
              <select
                className="panel-field-select"
                value={angle.ray1}
                onChange={(e) => handleUpdate(index, { ray1: e.target.value })}
              >
                {points.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Center</span>
              <select
                className="panel-field-select"
                value={angle.center}
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
              <span className="panel-field-label">Ray2</span>
              <select
                className="panel-field-select"
                value={angle.ray2}
                onChange={(e) => handleUpdate(index, { ray2: e.target.value })}
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
                value={angle.style || 'arc'}
                onChange={(e) => handleUpdate(index, { style: e.target.value as 'arc' | 'square' })}
              >
                <option value="arc">Arc</option>
                <option value="square">Square</option>
              </select>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Color</span>
              <input
                type="color"
                className="panel-color-input"
                value={angle.color || getDefaultAngleColor()}
                onChange={(e) => handleUpdate(index, { color: e.target.value })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Size</span>
              <input
                type="number"
                className="panel-field-input panel-field-input--short"
                value={angle.arcRadius || 30}
                min={10}
                max={100}
                onChange={(e) => handleUpdate(index, { arcRadius: Number(e.target.value) || 30 })}
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
        disabled={points.length < 3}
      >
        <Plus size={14} />
        <span>Add Angle</span>
      </button>
    </div>
  )
}
