'use client'

import React from 'react'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { Plus, Trash2 } from 'lucide-react'

type Locus = NonNullable<AxisSpecV1['elements']['geometricLoci']>[number]

interface LociPanelProps {
  loci: Locus[]
  onChange: (loci: Locus[]) => void
}

export const LociPanel: React.FC<LociPanelProps> = ({ loci, onChange }) => {
  const handleAdd = () => {
    const newLocus: Locus = {
      equation: '',
      style: 'solid',
      thickness: 2,
    }
    onChange([...loci, newLocus])
  }

  const handleRemove = (index: number) => {
    onChange(loci.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, updates: Partial<Locus>) => {
    onChange(loci.map((l, i) => (i === index ? { ...l, ...updates } : l)))
  }

  return (
    <div className="loci-panel">
      <div className="panel-items-list">
        {loci.map((locus, index) => (
          <div key={index} className="panel-item-row" style={{ flexWrap: 'wrap' }}>
            <div className="panel-field" style={{ flex: 2 }}>
              <span className="panel-field-label">Equation</span>
              <input
                type="text"
                className="panel-field-input"
                value={locus.equation}
                placeholder="e.g. x^2 + y^2 = 25"
                onChange={(e) => handleUpdate(index, { equation: e.target.value })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Style</span>
              <select
                className="panel-field-select"
                value={locus.style}
                onChange={(e) => handleUpdate(index, { style: e.target.value as Locus['style'] })}
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
                value={locus.thickness}
                min={1}
                max={10}
                onChange={(e) => handleUpdate(index, { thickness: Number(e.target.value) || 2 })}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Color</span>
              <input
                type="color"
                value={locus.color || '#3366cc'}
                style={{ width: 28, height: 24 }}
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
        <span>Add Locus</span>
      </button>
    </div>
  )
}
