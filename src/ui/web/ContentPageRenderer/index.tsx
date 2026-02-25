'use client'

import type { ContentPage } from '@/payload-types'
import { SafeHtml } from '@/ui/web/SafeHtml'

interface ContentPageRendererProps {
  contentPage: ContentPage
  className?: string
}

export function ContentPageRenderer({ contentPage, className }: ContentPageRendererProps) {
  return (
    <div className={className}>
      <SafeHtml
        html={contentPage.htmlContent}
        className="prose prose-lg dark:prose-invert max-w-none text-start [&_a]:text-primary [&_a]:underline [&_ul]:list-inside [&_ol]:list-inside"
      />
    </div>
  )
}
