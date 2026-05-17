/**
 * FailureCodePill — hover-able failure code badge with tooltip.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Hover-able badge showing a failure code with explanation tooltip.
 */
'use client'

import { useState } from 'react'
import { cn } from '@/infra/utils/ui'

export const FAILURE_CODE_LABELS: Record<string, string> = {
  TOO_MANY_SECTIONS: 'Too many sections (max 5)',
  PNG_FORBIDDEN: 'Embedded PNG data found',
  INVALID_SVG: 'SVG content is malformed',
  MISSING_QUESTION: 'Missing question prompt',
  MISSING_HINT: 'Missing hint',
  MISSING_SOLUTION: 'Missing solution',
  MISSING_FULL_SOLUTION: 'Missing full solution',
  MISSING_CORRECT_OPTION: 'MCQ missing correct option',
  MISSING_WRONG_OPTIONS: 'MCQ missing wrong options',
  INVALID_GEOMETRY_SPEC: 'Invalid geometry specification',
  INVALID_AXIS_SPEC: 'Invalid axis specification',
  INVALID_GUIDED_EXPLANATION: 'Invalid guided explanation',
}

interface FailureCodePillProps {
  code: string
  onClick?: () => void
  active?: boolean
}

export function FailureCodePill({ code, onClick, active }: FailureCodePillProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const label = FAILURE_CODE_LABELS[code] ?? code

  return (
    <div className="relative inline-block">
      <button
        onClick={onClick}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        className={cn(
          'font-mono text-[10px] px-1.5 py-0.5 rounded border transition-all duration-normal',
          active
            ? 'bg-[hsl(var(--error)/0.15)] text-[hsl(var(--error))] border-[hsl(var(--error)/0.4)]'
            : 'bg-[hsl(var(--error)/0.08)] text-[hsl(var(--error))] border-[hsl(var(--error)/0.2)] hover:bg-[hsl(var(--error)/0.15)]',
        )}
      >
        {code}
      </button>
      {tooltipVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 bg-[var(--theme-elevation-800)] text-[var(--theme-elevation-0)] text-label px-2 py-1 rounded shadow-elevation-2 whitespace-nowrap">
          {label}
        </div>
      )}
    </div>
  )
}
