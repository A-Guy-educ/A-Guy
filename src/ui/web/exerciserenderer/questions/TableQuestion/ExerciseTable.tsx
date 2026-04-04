/**
 * Exercise Table - Pure Table Renderer
 * Renders headers, rows, fillable inputs, and per-cell feedback.
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Check, X } from 'lucide-react'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import type { TableBlock, TableCellResult } from '../../types'

interface ExerciseTableProps {
  table: TableBlock
  cellValues: Record<string, string>
  onCellChange: (key: string, value: string) => void
  cellResults: TableCellResult[]
  disabled: boolean
}

function getAlignment(table: TableBlock, colIdx: number): 'left' | 'center' | 'right' {
  return table.columnAlignment?.[colIdx] ?? 'center'
}

function getCellResultMap(cellResults: TableCellResult[]): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const r of cellResults) {
    map[r.key] = r.isCorrect
  }
  return map
}

function isFillableCell(table: TableBlock, rowIdx: number, colIdx: number): boolean {
  if (!table.solutionFill) return false
  const key = `${rowIdx}-${colIdx}`
  return table.rowsData[rowIdx]?.[colIdx] === '' && key in (table.answers ?? {})
}

export function ExerciseTable({
  table,
  cellValues,
  onCellChange,
  cellResults,
  disabled,
}: ExerciseTableProps) {
  const resultMap = getCellResultMap(cellResults)
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }
  const borderCls = table.showBorders ? 'border border-border/30' : 'border-0'

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border/20 shadow-elevation-1">
      <table
        className={cn('w-full border-collapse table-fixed', table.showBorders && 'overflow-hidden')}
      >
        {table.showHeader && (
          <thead>
            <tr>
              {table.headers.map((header, ci) => (
                <th
                  key={ci}
                  className={cn(
                    'p-3.5 font-semibold text-body-sm bg-muted/50',
                    alignClass[getAlignment(table, ci)],
                    borderCls,
                    'border-b-2 border-b-border/20',
                  )}
                >
                  <MathMarkdown content={header} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rowsData.map((row, ri) => (
            <motion.tr
              key={ri}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: ri * 0.03 }}
              className={ri % 2 === 1 ? 'bg-muted/15' : ''}
            >
              {row.map((cell, ci) => {
                const key = `${ri}-${ci}`
                const fillable = isFillableCell(table, ri, ci)
                const result = resultMap[key]
                const align = getAlignment(table, ci)

                return (
                  <td key={ci} className={cn('p-3.5', alignClass[align], borderCls)}>
                    {fillable ? (
                      <FillableInput
                        cellKey={key}
                        value={cellValues[key] ?? ''}
                        onChange={onCellChange}
                        result={result}
                        disabled={disabled || result === true}
                        align={align}
                      />
                    ) : cell === '' ? (
                      <span className="block min-h-[1.5em]" />
                    ) : (
                      <MathMarkdown content={cell} />
                    )}
                  </td>
                )
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface FillableInputProps {
  cellKey: string
  value: string
  onChange: (key: string, value: string) => void
  result: boolean | undefined
  disabled: boolean
  align: 'left' | 'center' | 'right'
}

function FillableInput({ cellKey, value, onChange, result, disabled, align }: FillableInputProps) {
  return (
    <div className="relative">
      <input
        type="text"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(cellKey, e.target.value)}
        readOnly={disabled}
        className={cn(
          'w-full min-w-[120px] px-3 py-2 rounded-lg border-2 text-body-sm',
          'bg-background transition-all duration-normal',
          align === 'left' && 'text-left',
          align === 'center' && 'text-center',
          align === 'right' && 'text-right',
          result === true && 'border-success bg-success/6 text-success-foreground pe-8',
          result === false && 'border-destructive bg-destructive/6 text-destructive pe-8',
          result === undefined &&
            'border-dashed border-primary/25 bg-primary/3 focus:border-solid focus:border-primary focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] focus:outline-none',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />
      {result === true && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="absolute end-2 top-1/2 -translate-y-1/2 text-success"
        >
          <Check className="w-4 h-4" />
        </motion.span>
      )}
      {result === false && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="absolute end-2 top-1/2 -translate-y-1/2 text-destructive"
        >
          <X className="w-4 h-4" />
        </motion.span>
      )}
    </div>
  )
}
