'use client'

import React from 'react'
import type { LinePosition } from './matchingUtils'
import { CONNECTION_COLORS } from './matchingUtils'

interface MatchingLinesProps {
  lines: LinePosition[]
  getCorrectness: (leftId: string, rightId: string) => boolean | null
}

export function MatchingLines({ lines, getCorrectness }: MatchingLinesProps) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
      {lines.map((pos, i) => {
        const midX = (pos.x1 + pos.x2) / 2
        const correctness = getCorrectness(pos.leftId, pos.rightId)
        const strokeColor =
          correctness === true
            ? 'hsl(var(--success, 142 76% 36%))'
            : correctness === false
              ? 'hsl(var(--destructive))'
              : CONNECTION_COLORS[i % CONNECTION_COLORS.length]
        return (
          <path
            key={`${pos.leftId}-${pos.rightId}`}
            d={`M ${pos.x1} ${pos.y1} C ${midX} ${pos.y1}, ${midX} ${pos.y2}, ${pos.x2} ${pos.y2}`}
            stroke={strokeColor}
            strokeWidth={3}
            fill="none"
            opacity={0.8}
          />
        )
      })}
    </svg>
  )
}
