'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { Plus, Trash2 } from 'lucide-react'

type GeoText = NonNullable<GeometrySpecV1['elements']['texts']>[number]

interface TextsPanelProps {
  texts: GeoText[]
  onChange: (texts: GeoText[]) => void
}

export const TextsPanel: React.FC<TextsPanelProps> = ({ texts, onChange }) => {
  const handleAdd = () => {
    const newText: GeoText = { value: 'Label', place: { x: 100, y: 100 } }
    onChange([...texts, newText])
  }

  const handleRemove = (index: number) => {
    onChange(texts.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<GeoText>) => {
    onChange(texts.map((t, i) => (i === index ? { ...t, ...updates } : t)))
  }

  return (
    <div className="texts-panel">
      <div className="panel-items-list">
        {texts.map((text, index) => (
          <div key={index} className="panel-item-row">
            <div className="panel-field">
              <span className="panel-field-label">Text</span>
              <input
                type="text"
                className="panel-field-input panel-field-input--wide"
                value={text.value}
                onChange={(e) => handleUpdate(index, { value: e.target.value })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">X</span>
              <input
                type="number"
                className="panel-field-input"
                value={text.place?.x ?? 0}
                onChange={(e) =>
                  handleUpdate(index, { place: { ...text.place, x: Number(e.target.value) } })
                }
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Y</span>
              <input
                type="number"
                className="panel-field-input"
                value={text.place?.y ?? 0}
                onChange={(e) =>
                  handleUpdate(index, { place: { ...text.place, y: Number(e.target.value) } })
                }
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
        <span>Add Text</span>
      </button>
    </div>
  )
}
