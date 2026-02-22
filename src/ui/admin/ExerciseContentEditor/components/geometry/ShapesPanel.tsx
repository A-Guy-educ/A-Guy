'use client'

import React from 'react'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { Plus, Trash2 } from 'lucide-react'

type GeoTriangle = NonNullable<GeometrySpecV1['elements']['triangles']>[number]
type GeoRectangle = NonNullable<GeometrySpecV1['elements']['rectangles']>[number]
type GeoPoint = GeometrySpecV1['elements']['points'][number]

interface ShapesPanelProps {
  triangles: GeoTriangle[]
  rectangles: GeoRectangle[]
  points: GeoPoint[]
  onTrianglesChange: (triangles: GeoTriangle[]) => void
  onRectanglesChange: (rectangles: GeoRectangle[]) => void
}

export const ShapesPanel: React.FC<ShapesPanelProps> = ({
  triangles,
  rectangles,
  points,
  onTrianglesChange,
  onRectanglesChange,
}) => {
  const names = points.map((p) => p.name)

  const handleAddTriangle = () => {
    const tri: GeoTriangle = { points: [names[0] || '', names[1] || '', names[2] || ''] }
    onTrianglesChange([...triangles, tri])
  }

  const handleAddRectangle = () => {
    const rect: GeoRectangle = {
      points: [names[0] || '', names[1] || '', names[2] || '', names[3] || names[0] || ''],
    }
    onRectanglesChange([...rectangles, rect])
  }

  const updateTriPoint = (tIdx: number, pIdx: number, value: string) => {
    onTrianglesChange(
      triangles.map((t, i) => {
        if (i !== tIdx) return t
        const newPts = [...t.points]
        newPts[pIdx] = value
        return { ...t, points: newPts }
      }),
    )
  }

  const updateRectPoint = (rIdx: number, pIdx: number, value: string) => {
    onRectanglesChange(
      rectangles.map((r, i) => {
        if (i !== rIdx) return r
        const newPts = [...r.points]
        newPts[pIdx] = value
        return { ...r, points: newPts }
      }),
    )
  }

  return (
    <div className="shapes-panel">
      <label className="panel-field-label" style={{ marginBottom: 4 }}>
        Triangles
      </label>
      <div className="panel-items-list">
        {triangles.map((tri, tIdx) => (
          <div key={tIdx} className="panel-item-row">
            {tri.points.map((pt, pIdx) => (
              <select
                key={pIdx}
                className="panel-field-select"
                value={pt}
                onChange={(e) => updateTriPoint(tIdx, pIdx, e.target.value)}
              >
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ))}
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => onTrianglesChange(triangles.filter((_, i) => i !== tIdx))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="panel-add-btn"
        onClick={handleAddTriangle}
        disabled={points.length < 3}
      >
        <Plus size={14} />
        <span>Add Triangle</span>
      </button>

      <label className="panel-field-label" style={{ marginTop: 12, marginBottom: 4 }}>
        Rectangles
      </label>
      <div className="panel-items-list">
        {rectangles.map((rect, rIdx) => (
          <div key={rIdx} className="panel-item-row">
            {rect.points.map((pt, pIdx) => (
              <select
                key={pIdx}
                className="panel-field-select"
                value={pt}
                onChange={(e) => updateRectPoint(rIdx, pIdx, e.target.value)}
              >
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ))}
            <button
              type="button"
              className="panel-remove-btn"
              onClick={() => onRectanglesChange(rectangles.filter((_, i) => i !== rIdx))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="panel-add-btn"
        onClick={handleAddRectangle}
        disabled={points.length < 4}
      >
        <Plus size={14} />
        <span>Add Rectangle</span>
      </button>
    </div>
  )
}
