/**
 * SVG Renderer
 * Renders raw SVG blocks with basic sanitization
 */

import React from 'react'
import type { SvgBlock } from '@/contracts'
import './index.scss'

const baseClass = 'svg-renderer'

interface SvgRendererProps {
  block: SvgBlock
}

export function SvgRenderer({ block }: SvgRendererProps) {
  // Basic validation - ensure it's actually SVG
  const isSvg = block.svg.trim().startsWith('<svg')

  if (!isSvg) {
    return (
      <div className={`${baseClass} ${baseClass}--error`}>
        <span className={`${baseClass}__error-icon`}>⚠️</span>
        <span>Invalid SVG content</span>
      </div>
    )
  }

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__content`} dangerouslySetInnerHTML={{ __html: block.svg }} />
    </div>
  )
}
