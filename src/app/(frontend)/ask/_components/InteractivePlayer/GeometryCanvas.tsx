'use client'

import type {
  GeometryData,
  GeoPoint,
} from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

const COLORS: Record<string, string> = {
  blue: '#2563eb',
  red: '#dc2626',
  green: '#16a34a',
  orange: '#f59e0b',
  purple: '#7c3aed',
}

interface GeometryCanvasProps {
  geometry: GeometryData
  /** Segments to highlight: array of [from, to] pairs */
  highlightSegments: string[][]
  /** Points to highlight */
  highlightPoints: string[]
  /** Cumulative highlights from all steps up to current */
  allHighlightSegments: string[][]
  allHighlightPoints: string[]
}

/**
 * Renders the geometry diagram as an inline SVG.
 * Highlights segments and points that are relevant to the current proof step.
 */
export function GeometryCanvas({
  geometry,
  highlightSegments,
  highlightPoints,
  allHighlightSegments,
  allHighlightPoints,
}: GeometryCanvasProps) {
  const pointMap = new Map(geometry.points.map((p) => [p.label, p]))
  const pad = 30

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${geometry.width + pad * 2} ${geometry.height + pad * 2}`}
      className="w-full h-full"
      style={{ maxHeight: '350px' }}
    >
      {/* Segments */}
      {geometry.segments.map((seg, i) => {
        const from = pointMap.get(seg.from)
        const to = pointMap.get(seg.to)
        if (!from || !to) return null

        const isCurrentHighlight = isSegmentInList(seg.from, seg.to, highlightSegments)
        const isAnyHighlight = isSegmentInList(seg.from, seg.to, allHighlightSegments)
        const color = seg.color ? COLORS[seg.color] || seg.color : '#94a3b8'
        const activeColor = isCurrentHighlight ? color : isAnyHighlight ? color : '#cbd5e1'
        const strokeWidth = isCurrentHighlight ? 3 : seg.style === 'bold' ? 3 : 2
        const opacity = isAnyHighlight ? 1 : 0.4

        return (
          <line
            key={`seg-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.style === 'dashed' ? '6 4' : undefined}
            opacity={opacity}
            className="transition-all duration-slower"
          />
        )
      })}

      {/* Angle markers */}
      {geometry.angles?.map((angle, i) => {
        const p1 = pointMap.get(angle.points[0])
        const vertex = pointMap.get(angle.points[1])
        const p2 = pointMap.get(angle.points[2])
        if (!p1 || !vertex || !p2) return null
        return renderAngleMarker(p1, vertex, p2, angle.rightAngle, i)
      })}

      {/* Equal marks on highlighted segments */}
      {renderEqualMarks(geometry, pointMap, allHighlightSegments)}

      {/* Point labels */}
      {geometry.points.map((point) => {
        const isHighlighted = allHighlightPoints.includes(point.label)
        const isCurrentStep = highlightPoints.includes(point.label)
        return (
          <g key={`pt-${point.label}`}>
            {isHighlighted && (
              <circle
                cx={point.x}
                cy={point.y}
                r={isCurrentStep ? 5 : 4}
                fill="#2563eb"
                className="transition-all duration-slow"
              />
            )}
            <text
              x={point.x}
              y={point.y}
              dy={point.y < geometry.height / 2 ? -12 : 20}
              textAnchor="middle"
              className="transition-all duration-slow"
              fill={isHighlighted ? '#2563eb' : '#64748b'}
              fontWeight={isHighlighted ? 700 : 500}
              fontSize={14}
            >
              {point.label}
            </text>
          </g>
        )
      })}

      {/* Extra labels (measurements etc) */}
      {geometry.labels?.map((label, i) => (
        <text
          key={`lbl-${i}`}
          x={label.x}
          y={label.y}
          fontSize={label.fontSize || 12}
          fill="#475569"
          textAnchor="middle"
        >
          {label.text}
        </text>
      ))}
    </svg>
  )
}

function isSegmentInList(from: string, to: string, list: string[][]): boolean {
  return list.some(([a, b]) => (a === from && b === to) || (a === to && b === from))
}

function renderAngleMarker(
  p1: GeoPoint,
  vertex: GeoPoint,
  p2: GeoPoint,
  rightAngle: boolean | undefined,
  key: number,
) {
  const r = 18
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x)
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x)

  if (rightAngle) {
    const dx1 = Math.cos(a1) * r
    const dy1 = Math.sin(a1) * r
    const dx2 = Math.cos(a2) * r
    const dy2 = Math.sin(a2) * r
    const path = `M ${vertex.x + dx1} ${vertex.y + dy1} L ${vertex.x + dx1 + dx2} ${vertex.y + dy1 + dy2} L ${vertex.x + dx2} ${vertex.y + dy2}`
    return <path key={`angle-${key}`} d={path} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
  }

  const startAngle = a1
  const endAngle = a2
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0
  const sx = vertex.x + r * Math.cos(startAngle)
  const sy = vertex.y + r * Math.sin(startAngle)
  const ex = vertex.x + r * Math.cos(endAngle)
  const ey = vertex.y + r * Math.sin(endAngle)

  return (
    <path
      key={`angle-${key}`}
      d={`M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
      fill="none"
      stroke="#f59e0b"
      strokeWidth={1.5}
    />
  )
}

function renderEqualMarks(
  geometry: GeometryData,
  pointMap: Map<string, GeoPoint>,
  highlights: string[][],
) {
  // Group highlighted segments to find pairs that should get equal marks
  return highlights.map(([from, to], i) => {
    const p1 = pointMap.get(from)
    const p2 = pointMap.get(to)
    if (!p1 || !p2) return null
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2
    const tickLen = 6
    return (
      <line
        key={`tick-${i}`}
        x1={mx - tickLen * Math.cos(angle)}
        y1={my - tickLen * Math.sin(angle)}
        x2={mx + tickLen * Math.cos(angle)}
        y2={my + tickLen * Math.sin(angle)}
        stroke="#2563eb"
        strokeWidth={2}
      />
    )
  })
}
