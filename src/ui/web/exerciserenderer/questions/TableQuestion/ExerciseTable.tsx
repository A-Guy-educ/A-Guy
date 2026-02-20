/**
 * Exercise Table - Pure Table Renderer
 * Renders headers, rows, fillable inputs, and per-cell feedback.
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
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
  const borderCls = table.showBorders ? 'border border-border' : 'border-0'

  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse table-fixed',
          table.showBorders && 'shadow-sm rounded-md overflow-hidden',
        )}
      >
        {table.showHeader && (
          <thead>
            <tr>
              {table.headers.map((header, ci) => (
                <th
                  key={ci}
                  className={cn(
                    'p-3 font-semibold bg-muted',
                    alignClass[getAlignment(table, ci)],
                    borderCls,
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
            <tr key={ri} className={ri % 2 === 1 ? 'bg-muted/30' : ''}>
              {row.map((cell, ci) => {
                const key = `${ri}-${ci}`
                const fillable = isFillableCell(table, ri, ci)
                const result = resultMap[key]
                const align = getAlignment(table, ci)

                return (
                  <td key={ci} className={cn('p-3', alignClass[align], borderCls)}>
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
            </tr>
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
    <input
      type="text"
      dir="ltr"
      value={value}
      onChange={(e) => onChange(cellKey, e.target.value)}
      readOnly={disabled}
      className={cn(
        'w-full min-w-[120px] px-2 py-1.5 rounded-md border-2 text-sm',
        'bg-background transition-colors duration-200',
        align === 'left' && 'text-left',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        result === true && 'border-success bg-success/10 text-success-foreground',
        result === false && 'border-destructive bg-destructive/10 text-destructive',
        result === undefined && 'border-input focus:border-ring focus:outline-none',
        disabled && 'opacity-70 cursor-not-allowed',
      )}
    />
  )
}
