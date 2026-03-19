import React from 'react'
import { cn } from '@/infra/utils/ui'

import type { TableBlock as TableBlockType } from '@/payload-types'

type Props = TableBlockType & {
  className?: string
  disableInnerContainer?: boolean
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const TableBlock: React.FC<Props> = ({ headers, rows, showBorders, showHeader }) => {
  const parsedHeaders = safeJsonParse<string[]>(headers, [])
  const parsedRows = safeJsonParse<string[][]>(rows, [])

  if (parsedHeaders.length === 0 && parsedRows.length === 0) return null

  const borderCls = showBorders ? 'border border-border' : 'border-0'

  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          'w-full border-collapse',
          showBorders && 'shadow-sm rounded-md overflow-hidden',
        )}
      >
        {showHeader && parsedHeaders.length > 0 && (
          <thead>
            <tr>
              {parsedHeaders.map((header, ci) => (
                <th key={ci} className={cn('p-3 font-semibold bg-muted text-center', borderCls)}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {parsedRows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? 'bg-muted/30' : ''}>
              {(Array.isArray(row) ? row : []).map((cell, ci) => (
                <td key={ci} className={cn('p-3 text-center', borderCls)}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
