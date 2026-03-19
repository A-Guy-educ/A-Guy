import React from 'react'

interface ContentPageRendererProps {
  title: string
  bodyRendered: React.ReactNode
}

export function ContentPageRenderer({ title, bodyRendered }: ContentPageRendererProps) {
  return (
    <div className="w-full p-4 md:p-6 space-y-4">
      <div className="bg-card rounded-2xl p-5 md:p-6 border border-border/60 shadow-sm">
        <h2 className="text-xl font-medium text-foreground mb-4">{title}</h2>
        <div className="prose prose-lg max-w-none dark:prose-invert">{bodyRendered}</div>
      </div>
    </div>
  )
}
