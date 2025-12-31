import React from 'react'
import type { ExerciseBlock } from '@/contracts'
import type { PreviewMode } from '../../types'
import { RichTextRenderer } from '../RichTextRenderer'
import { TableRenderer } from '../TableRenderer'
import { AxisRenderer } from '../AxisRenderer'
import { GeometryRenderer } from '../GeometryRenderer'
import { FigureRenderer } from '../FigureRenderer'
import { SectionRenderer } from '../SectionRenderer'
import './index.scss'

const baseClass = 'block-renderer'

interface BlockRendererProps {
  block: ExerciseBlock
  mode?: PreviewMode
}

export function BlockRenderer({ block, mode = 'student' }: BlockRendererProps) {
  switch (block.type) {
    case 'rich_text':
      return <RichTextRenderer block={block} />

    case 'table':
      return <TableRenderer block={block} />

    case 'figure':
      return <FigureRenderer block={block} />

    case 'section':
      return <SectionRenderer block={block} mode={mode} />

    case 'axis_system':
      return <AxisRenderer block={block} />

    case 'geometry':
      return <GeometryRenderer block={block} />

    default:
      return (
        <div className={`${baseClass} ${baseClass}--unknown`}>
          <span className={`${baseClass}__icon`}>⚠️</span>
          <span>Unknown block type: {(block as any).type}</span>
          {mode === 'debug' && (
            <code className={`${baseClass}__debug`}>{JSON.stringify(block, null, 2)}</code>
          )}
        </div>
      )
  }
}
