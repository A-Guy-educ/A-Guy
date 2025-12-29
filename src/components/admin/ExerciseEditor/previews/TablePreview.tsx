/**
 * Table Preview Component
 * Renders a read-only HTML table preview
 */

import React from 'react'
import type { TableBlock } from '@/contracts'

interface TablePreviewProps {
  block: TableBlock
}

export function TablePreview({ block }: TablePreviewProps) {
  const { headers, rows, showHeader, showBorders, columnAlignment } = block

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: showBorders ? 'collapse' : 'separate',
    border: showBorders ? '1px solid var(--theme-elevation-300)' : 'none',
  }

  const cellStyle = (colIdx: number, isHeader: boolean): React.CSSProperties => ({
    padding: '0.5rem 0.75rem',
    textAlign: columnAlignment[colIdx] || 'left',
    border: showBorders ? '1px solid var(--theme-elevation-300)' : 'none',
    background: isHeader ? 'var(--theme-elevation-100)' : 'transparent',
    fontWeight: isHeader ? 500 : 'normal',
  })

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '4px',
        padding: '0.75rem',
        background: 'white',
        overflow: 'auto',
      }}
    >
      <table style={tableStyle}>
        {showHeader && (
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} style={cellStyle(idx, true)}>
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
                <td key={colIdx} style={cellStyle(colIdx, false)}>
                  {cell || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            fontSize: '0.875rem',
            opacity: 0.6,
          }}
        >
          No rows in table
        </div>
      )}
    </div>
  )
}
