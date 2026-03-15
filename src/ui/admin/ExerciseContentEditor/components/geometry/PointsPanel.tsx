'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import {
  cssVarToHex,
  getDefaultTextColor,
  getTextColorPalette,
} from '@/infra/contracts/graphics/textColors'
import { Plus, Trash2 } from 'lucide-react'

type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface PointsPanelProps {
  points: GeoPoint[]
  onChange: (points: GeoPoint[]) => void
}

const DEFAULT_POINT_SIZE = 1
const DEFAULT_POINT_POSITION = 'r' as const

const COMPASS_CELLS = [
  { pos: 'tl', arrow: '↖' },
  { pos: 't', arrow: '↑' },
  { pos: 'tr', arrow: '↗' },
  { pos: 'l', arrow: '←' },
  { pos: null, arrow: '' },
  { pos: 'r', arrow: '→' },
  { pos: 'bl', arrow: '↙' },
  { pos: 'b', arrow: '↓' },
  { pos: 'br', arrow: '↘' },
] as const

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
      color: getDefaultTextColor(),
      size: DEFAULT_POINT_SIZE,
      position: DEFAULT_POINT_POSITION,
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
            <div className="panel-field">
              <span className="panel-field-label">Color</span>
              <div className="color-swatches-row">
                {getTextColorPalette().map((colorOption) => (
                  <button
                    key={colorOption.hex}
                    type="button"
                    className={`color-swatch ${point.color === colorOption.hex || (!point.color && colorOption.hex === getDefaultTextColor()) ? 'color-swatch--selected' : ''}`}
                    style={{ backgroundColor: colorOption.hex }}
                    title={colorOption.label}
                    onClick={() => handleUpdate(index, { color: colorOption.hex })}
                  />
                ))}
              </div>
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Size (1-5)</span>
              <input
                type="number"
                className="panel-field-input"
                min={1}
                max={5}
                step={1}
                value={point.size ?? DEFAULT_POINT_SIZE}
                onChange={(e) => {
                  const raw = parseInt(e.target.value, 10)
                  handleUpdate(index, {
                    size: isNaN(raw) ? DEFAULT_POINT_SIZE : Math.max(1, Math.min(5, raw)),
                  })
                }}
              />
            </div>
            <div className="panel-field">
              <span className="panel-field-label">Label</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 20px)',
                  gap: 2,
                }}
              >
                {COMPASS_CELLS.map((cell, i) =>
                  cell.pos ? (
                    <button
                      key={cell.pos}
                      type="button"
                      title={cell.pos}
                      onClick={() =>
                        handleUpdate(index, {
                          position: cell.pos as GeoPoint['position'],
                        })
                      }
                      style={{
                        width: 20,
                        height: 20,
                        padding: 0,
                        fontSize: 11,
                        border: `1px solid ${cssVarToHex('--border')}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        background:
                          (point.position ?? DEFAULT_POINT_POSITION) === cell.pos
                            ? cssVarToHex('--primary')
                            : cssVarToHex('--muted'),
                        color:
                          (point.position ?? DEFAULT_POINT_POSITION) === cell.pos
                            ? cssVarToHex('--primary-foreground')
                            : cssVarToHex('--foreground'),
                      }}
                    >
                      {cell.arrow}
                    </button>
                  ) : (
                    <span key={i} style={{ width: 20, height: 20 }} />
                  ),
                )}
              </div>
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
