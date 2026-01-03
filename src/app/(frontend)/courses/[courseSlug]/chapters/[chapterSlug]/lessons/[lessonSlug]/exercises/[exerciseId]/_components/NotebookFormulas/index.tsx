'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { useTranslations } from '@/providers/I18n'
import './index.scss'

export function NotebookFormulas() {
  const t = useTranslations('courses')

  const content = `### ${t('formulaSubtitle')}

$\\cos(\\alpha) = \\frac{AB}{AC}$

$a^2 = b^2 + c^2 - 2bc \\cos(\\alpha)$`

  return (
    <div className="notebook-formulas">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
