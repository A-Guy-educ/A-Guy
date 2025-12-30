/**
 * Block Renderer Dispatcher
 * Routes different block types to their specific renderers
 */

import React from 'react'
import type { ExerciseBlock } from '@/contracts'
import type { PreviewMode } from '../../types'
import { RichTextRenderer } from '../RichTextRenderer'
import { TableRenderer } from '../TableRenderer'
import { SvgRenderer } from '../SvgRenderer'
import { AxisRenderer } from '../AxisRenderer'
import { GeometryRenderer } from '../GeometryRenderer'
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

    case 'svg':
      return <SvgRenderer block={block} />

    case 'axis_system':
      return <AxisRenderer block={block} />

    case 'geometry':
      return <GeometryRenderer block={block} />

    default:
      return (
        <div className={`${baseClass} ${baseClass}--unknown`}>
          <span className={`${baseClass}__icon`}>⚠️</span>
          <span>Unknown block type</span>
          {mode === 'debug' && (
            <code className={`${baseClass}__debug`}>{JSON.stringify(block, null, 2)}</code>
          )}
        </div>
      )
  }
}
