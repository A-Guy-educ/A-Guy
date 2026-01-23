'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { useTranslations } from '@/ui/providers/I18n'

export function NotebookFormulas() {
  const t = useTranslations('courses')

  const content = `### ${t('formulaSubtitle')}

$\\cos(\\alpha) = \\frac{AB}{AC}$

$a^2 = b^2 + c^2 - 2bc \\cos(\\alpha)$`

  return (
    <div className="p-7 bg-card text-foreground h-full overflow-y-auto rich-text-content">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
