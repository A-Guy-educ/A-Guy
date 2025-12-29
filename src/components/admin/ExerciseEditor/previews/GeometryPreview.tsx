/**
 * Geometry Preview Component
 * Renders a read-only SVG preview of geometric elements
 */

import React from 'react'
import type { GeometrySpecV1 } from '@/contracts'

interface GeometryPreviewProps {
  spec: GeometrySpecV1
}

export function GeometryPreview({ spec }: GeometryPreviewProps) {
  const width = spec.canvas?.width || 600
  const height = spec.canvas?.height || 400
  const showGrid = spec.canvas?.grid || false

  // Helper to get point coordinates by name
  const getPoint = (name: string): { x: number; y: number } | null => {
    const point = spec.elements?.points?.find((p) => p.name === name)
    return point ? { x: point.x, y: point.y } : null
  }

  // Render grid
  const renderGrid = () => {
    if (!showGrid) return null

    const lines: React.ReactElement[] = []
    const gridSize = 50

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      lines.push(
        <line
          key={`vgrid-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="var(--theme-elevation-200)"
          strokeWidth="1"
          opacity="0.3"
        />,
      )
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      lines.push(
        <line
          key={`hgrid-${y}`}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="var(--theme-elevation-200)"
          strokeWidth="1"
          opacity="0.3"
        />,
      )
    }

    return <g>{lines}</g>
  }

  // Render points
  const renderPoints = () => {
    const points = spec.elements?.points || []
    return (
      <g>
        {points.map((point, idx) => (
          <g key={`point-${idx}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="var(--theme-success-500)"
              stroke="white"
              strokeWidth="2"
            />
            {point.name && (
              <text
                x={point.x + 10}
                y={point.y - 10}
                fontSize="14"
                fill="var(--theme-elevation-700)"
                fontWeight="500"
              >
                {point.name}
              </text>
            )}
          </g>
        ))}
      </g>
    )
  }

  // Render lines
  const renderLines = () => {
    const lines = spec.elements?.lines || []
    const warnings: string[] = []

    return (
      <g>
        {lines.map((line, idx) => {
          const from = getPoint(line.from)
          const to = getPoint(line.to)

          if (!from) {
            warnings.push(`Line ${idx + 1}: Unknown point "${line.from}"`)
            return null
          }
          if (!to) {
            warnings.push(`Line ${idx + 1}: Unknown point "${line.to}"`)
            return null
          }

          return (
            <line
              key={`line-${idx}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--theme-info-500)"
              strokeWidth="2"
            />
          )
        })}
        {warnings.length > 0 && (
          <text x={10} y={20} fontSize="12" fill="var(--theme-error-500)">
            {warnings[0]}
          </text>
        )}
      </g>
    )
  }

  // Render circles
  const renderCircles = () => {
    const circles = spec.elements?.circles || []
    const warnings: string[] = []

    return (
      <g>
        {circles.map((circle, idx) => {
          const center = getPoint(circle.center)
          if (!center) {
            warnings.push(`Circle ${idx + 1}: Unknown center point "${circle.center}"`)
            return null
          }

          let radius: number

          // If through point is specified, calculate radius from center to through point
          if (circle.through) {
            const through = getPoint(circle.through)
            if (!through) {
              warnings.push(`Circle ${idx + 1}: Unknown through point "${circle.through}"`)
              return null
            }
            // Calculate radius as distance from center to through point
            const dx = through.x - center.x
            const dy = through.y - center.y
            radius = Math.sqrt(dx * dx + dy * dy)
          } else if (circle.radius) {
            // Use explicit radius value
            radius = circle.radius
          } else {
            // No radius specified
            return null
          }

          return (
            <circle
              key={`circle-${idx}`}
              cx={center.x}
              cy={center.y}
              r={radius}
              fill="none"
              stroke="var(--theme-info-500)"
              strokeWidth="2"
            />
          )
        })}
        {warnings.length > 0 && (
          <text x={10} y={40} fontSize="12" fill="var(--theme-error-500)">
            {warnings[0]}
          </text>
        )}
      </g>
    )
  }

  // Render angles (basic - just the arc, not interactive)
  const renderAngles = () => {
    const angles = spec.elements?.angles || []
    const warnings: string[] = []

    return (
      <g>
        {angles.map((angle, idx) => {
          const center = getPoint(angle.center)
          const ray1 = getPoint(angle.ray1)
          const ray2 = getPoint(angle.ray2)

          if (!center) {
            warnings.push(`Angle ${idx + 1}: Unknown center "${angle.center}"`)
            return null
          }
          if (!ray1 || !ray2) return null

          // Calculate angles
          const angle1 = Math.atan2(ray1.y - center.y, ray1.x - center.x)
          const angle2 = Math.atan2(ray2.y - center.y, ray2.x - center.x)

          const arcRadius = angle.arcRadius || 30
          const startAngle = angle1
          const endAngle = angle2

          // Create arc path
          const x1 = center.x + arcRadius * Math.cos(startAngle)
          const y1 = center.y + arcRadius * Math.sin(startAngle)
          const x2 = center.x + arcRadius * Math.cos(endAngle)
          const y2 = center.y + arcRadius * Math.sin(endAngle)

          const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0

          return (
            <path
              key={`angle-${idx}`}
              d={`M ${x1} ${y1} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`}
              fill="none"
              stroke="var(--theme-warning-500)"
              strokeWidth="2"
            />
          )
        })}
        {warnings.length > 0 && (
          <text x={10} y={60} fontSize="12" fill="var(--theme-error-500)">
            {warnings[0]}
          </text>
        )}
      </g>
    )
  }

  return (
    <svg
      width={width}
      height={height}
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '4px',
        background: 'white',
      }}
    >
      {renderGrid()}
      {renderLines()}
      {renderCircles()}
      {renderAngles()}
      {renderPoints()}
    </svg>
  )
}
