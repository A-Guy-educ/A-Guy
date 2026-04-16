'use client'

import type { LatexBlock } from '@/server/payload/collections/Exercises/types'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import React from 'react'

interface LatexBlockRendererProps {
  block: LatexBlock
}

export const LatexBlockRenderer: React.FC<LatexBlockRendererProps> = ({ block }) => {
  const renderMode = block.renderMode ?? 'block'
  const wrapped = renderMode === 'inline' ? `$${block.latex}$` : `$$\n${block.latex}\n$$`

  return <MathMarkdown content={wrapped} />
}
