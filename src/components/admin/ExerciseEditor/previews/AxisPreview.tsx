/**
 * Axis System Preview Component
 * Renders a read-only SVG preview of an axis system with grid, axes, points, and graphs
 */

import React from 'react'
import type { AxisSpecV1 } from '@/contracts'
import { parseMathExpression } from './safeMathEval'

interface AxisPreviewProps {
  spec: AxisSpecV1
  width?: number
  height?: number
}

export function AxisPreview({ spec, width = 600, height = 400 }: AxisPreviewProps) {
  // Calculate viewport bounds
  const units = spec.units || 50
  const origin = spec.axes?.origin || { x: 0, y: 0 }

  // Viewport in world coordinates (with defaults if not specified)
  const viewportXMin = spec.viewport?.xMin ?? -width / (2 * units)
  const viewportXMax = spec.viewport?.xMax ?? width / (2 * units)
  const viewportYMin = spec.viewport?.yMin ?? -height / (2 * units)
  const viewportYMax = spec.viewport?.yMax ?? height / (2 * units)

  // Transform world coordinates to SVG coordinates
  const worldToSvg = (wx: number, wy: number): { x: number; y: number } => {
    const x = ((wx - viewportXMin) / (viewportXMax - viewportXMin)) * width
    const y = height - ((wy - viewportYMin) / (viewportYMax - viewportYMin)) * height
    return { x, y }
  }

  // Render grid
  const renderGrid = () => {
    if (!spec.grid?.enabled) return null

    const lines: React.ReactElement[] = []
    const tickSize = spec.axes?.ticks || 1

    // Vertical grid lines
    const xStart = Math.floor(viewportXMin / tickSize) * tickSize
    const xEnd = Math.ceil(viewportXMax / tickSize) * tickSize
    for (let x = xStart; x <= xEnd; x += tickSize) {
      const { x: x1 } = worldToSvg(x, viewportYMin)
      const { x: x2 } = worldToSvg(x, viewportYMax)
      lines.push(
        <line
          key={`vgrid-${x}`}
          x1={x1}
          y1={0}
          x2={x2}
          y2={height}
          stroke="var(--theme-elevation-200)"
          strokeWidth="1"
          opacity="0.3"
        />,
      )
    }

    // Horizontal grid lines
    const yStart = Math.floor(viewportYMin / tickSize) * tickSize
    const yEnd = Math.ceil(viewportYMax / tickSize) * tickSize
    for (let y = yStart; y <= yEnd; y += tickSize) {
      const { y: y1 } = worldToSvg(viewportXMin, y)
      const { y: y2 } = worldToSvg(viewportXMax, y)
      lines.push(
        <line
          key={`hgrid-${y}`}
          x1={0}
          y1={y1}
          x2={width}
          y2={y2}
          stroke="var(--theme-elevation-200)"
          strokeWidth="1"
          opacity="0.3"
        />,
      )
    }

    return <g>{lines}</g>
  }

  // Render axes
  const renderAxes = () => {
    const { x: originX, y: originY } = worldToSvg(origin.x, origin.y)

    return (
      <g>
        {/* X-axis */}
        <line
          x1={0}
          y1={originY}
          x2={width}
          y2={originY}
          stroke="var(--theme-elevation-500)"
          strokeWidth="2"
        />
        {/* Y-axis */}
        <line
          x1={originX}
          y1={0}
          x2={originX}
          y2={height}
          stroke="var(--theme-elevation-500)"
          strokeWidth="2"
        />

        {/* Axis labels */}
        {spec.axes?.showLabels && (
          <>
            <text x={width - 10} y={originY - 10} fontSize="12" fill="var(--theme-elevation-700)">
              {spec.axes.labels?.x || 'x'}
            </text>
            <text x={originX + 10} y={10} fontSize="12" fill="var(--theme-elevation-700)">
              {spec.axes.labels?.y || 'y'}
            </text>
          </>
        )}

        {/* Tick marks and numbers */}
        {spec.axes?.showNumbers && renderTicks()}
      </g>
    )
  }

  // Render tick marks
  const renderTicks = () => {
    const ticks: React.ReactElement[] = []
    const tickSize = spec.axes?.ticks || 1
    const { x: originX, y: originY } = worldToSvg(origin.x, origin.y)

    // X-axis ticks
    const xStart = Math.floor(viewportXMin / tickSize) * tickSize
    const xEnd = Math.ceil(viewportXMax / tickSize) * tickSize
    for (let x = xStart; x <= xEnd; x += tickSize) {
      if (Math.abs(x - origin.x) < 0.001) continue // Skip origin
      const { x: tickX } = worldToSvg(x, origin.y)
      ticks.push(
        <g key={`xtick-${x}`}>
          <line
            x1={tickX}
            y1={originY - 5}
            x2={tickX}
            y2={originY + 5}
            stroke="var(--theme-elevation-500)"
            strokeWidth="1"
          />
          <text
            x={tickX}
            y={originY + 20}
            fontSize="10"
            fill="var(--theme-elevation-600)"
            textAnchor="middle"
          >
            {x.toFixed(x % 1 === 0 ? 0 : 1)}
          </text>
        </g>,
      )
    }

    // Y-axis ticks
    const yStart = Math.floor(viewportYMin / tickSize) * tickSize
    const yEnd = Math.ceil(viewportYMax / tickSize) * tickSize
    for (let y = yStart; y <= yEnd; y += tickSize) {
      if (Math.abs(y - origin.y) < 0.001) continue // Skip origin
      const { y: tickY } = worldToSvg(origin.x, y)
      ticks.push(
        <g key={`ytick-${y}`}>
          <line
            x1={originX - 5}
            y1={tickY}
            x2={originX + 5}
            y2={tickY}
            stroke="var(--theme-elevation-500)"
            strokeWidth="1"
          />
          <text
            x={originX - 10}
            y={tickY + 4}
            fontSize="10"
            fill="var(--theme-elevation-600)"
            textAnchor="end"
          >
            {y.toFixed(y % 1 === 0 ? 0 : 1)}
          </text>
        </g>,
      )
    }

    return <g>{ticks}</g>
  }

  // Render points
  const renderPoints = () => {
    const points = spec.elements?.points || []
    return (
      <g>
        {points.map((point, idx) => {
          const { x, y } = worldToSvg(point.x, point.y)
          return (
            <g key={`point-${idx}`}>
              <circle
                cx={x}
                cy={y}
                r="4"
                fill="var(--theme-success-500)"
                stroke="white"
                strokeWidth="2"
              />
              {point.label && (
                <text
                  x={x + 8}
                  y={y - 8}
                  fontSize="12"
                  fill="var(--theme-elevation-700)"
                  fontWeight="500"
                >
                  {point.label}
                </text>
              )}
            </g>
          )
        })}
      </g>
    )
  }

  // Render graphs (function plots)
  const renderGraphs = () => {
    const graphs = spec.elements?.graphs || []
    const samples = 200
    const dx = (viewportXMax - viewportXMin) / samples

    return (
      <g>
        {graphs.map((graph, idx) => {
          // All graphs are function graphs in this spec version
          const parseResult = parseMathExpression(graph.fn)
          if (!parseResult.valid) {
            return (
              <text
                key={`graph-error-${idx}`}
                x={10}
                y={20 + idx * 20}
                fontSize="12"
                fill="var(--theme-error-500)"
              >
                Graph {idx + 1}: {parseResult.error}
              </text>
            )
          }

          const points: string[] = []
          for (let i = 0; i <= samples; i++) {
            const wx = viewportXMin + i * dx
            const wy = parseResult.evaluate(wx)

            if (!isNaN(wy) && isFinite(wy)) {
              const { x, y } = worldToSvg(wx, wy)
              // Only include points within SVG bounds
              if (y >= 0 && y <= height) {
                points.push(`${x},${y}`)
              }
            }
          }

          if (points.length === 0) return null

          return (
            <polyline
              key={`graph-${idx}`}
              points={points.join(' ')}
              fill="none"
              stroke="var(--theme-info-500)"
              strokeWidth="2"
            />
          )
        })}
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
      {renderAxes()}
      {renderGraphs()}
      {renderPoints()}
    </svg>
  )
}
