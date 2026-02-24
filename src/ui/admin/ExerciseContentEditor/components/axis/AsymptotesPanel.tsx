'use client'

import React from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface AsymptotesPanelProps {
  vertical: number[]
  horizontal: number[]
  onVerticalChange: (values: number[]) => void
  onHorizontalChange: (values: number[]) => void
}

export const AsymptotesPanel: React.FC<AsymptotesPanelProps> = ({
  vertical,
  horizontal,
  onVerticalChange,
  onHorizontalChange,
}) => {
  return (
    <div className="asymptotes-panel">
      <label className="panel-field-label" style={{ marginBottom: 4 }}>
        Vertical (x = ?)
      </label>
      <div className="panel-items-list">
        {vertical.map((val, index) => (
          <div key={index} className="panel-item-row">
            <span style={{ fontSize: '0.8125rem' }}>x =</span>
            <input
              type="number"
              className="panel-field-input"
              value={val}
              onChange={(e) => {
                const updated = [...vertical]
                updated[index] = Number(e.target.value)
                onVerticalChange(updated)
              }}
            />
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => onVerticalChange(vertical.filter((_, i) => i !== index))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="panel-add-btn"
        onClick={() => onVerticalChange([...vertical, 0])}
      >
        <Plus size={14} />
        <span>Add Vertical</span>
      </button>

      <label className="panel-field-label" style={{ marginTop: 12, marginBottom: 4 }}>
        Horizontal (y = ?)
      </label>
      <div className="panel-items-list">
        {horizontal.map((val, index) => (
          <div key={index} className="panel-item-row">
            <span style={{ fontSize: '0.8125rem' }}>y =</span>
            <input
              type="number"
              className="panel-field-input"
              value={val}
              onChange={(e) => {
                const updated = [...horizontal]
                updated[index] = Number(e.target.value)
                onHorizontalChange(updated)
              }}
            />
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => onHorizontalChange(horizontal.filter((_, i) => i !== index))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="panel-add-btn"
        onClick={() => onHorizontalChange([...horizontal, 0])}
      >
        <Plus size={14} />
        <span>Add Horizontal</span>
      </button>
    </div>
  )
}
