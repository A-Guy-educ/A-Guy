/**
 * Table Renderer
 * Renders table blocks with headers, borders, and alignment
 */

import React from 'react'
import { cn } from '@/utilities/ui'
import type { TableBlock } from '@/contracts'
import './index.scss'

const baseClass = 'table-renderer'

interface TableRendererProps {
  block: TableBlock
}

export function TableRenderer({ block }: TableRendererProps) {
  const { headers, rows, showHeader, showBorders, columnAlignment } = block

  const getCellAlignment = (colIdx: number): string => {
    return columnAlignment[colIdx] || 'left'
  }

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__wrapper`}>
        <table
          className={cn(`${baseClass}__table`, showBorders && `${baseClass}__table--bordered`)}
        >
          {showHeader && (
            <thead>
              <tr>
                {headers.map((header, idx) => (
                  <th
                    key={idx}
                    className={`${baseClass}__header`}
                    style={{ textAlign: getCellAlignment(idx) as any }}
                  >
                    {header || `Column ${idx + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className={`${baseClass}__cell`}
                    style={{ textAlign: getCellAlignment(colIdx) as any }}
                  >
                    {cell || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className={`${baseClass}__empty`}>No rows in table</div>}
      </div>
    </div>
  )
}
