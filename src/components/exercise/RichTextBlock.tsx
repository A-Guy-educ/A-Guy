import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface RichTextBlockProps {
  content: string
  format: string
}

export function RichTextBlock({ content, format }: RichTextBlockProps) {
  // For md-math-v1 format, use markdown with math support
  if (format === 'md-math-v1') {
    return (
      <div className="prose prose-slate max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // Customize heading styles
            h1: ({ node, ...props }) => (
              <h1 className="text-2xl font-bold mb-4 text-slate-900" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-xl font-semibold mb-3 text-slate-900" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-lg font-semibold mb-2 text-slate-900" {...props} />
            ),
            p: ({ node, ...props }) => (
              <p className="mb-3 text-slate-700 leading-relaxed" {...props} />
            ),
            a: ({ node, ...props }) => (
              <a
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-inside mb-3 space-y-1" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />
            ),
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code
                  className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-slate-800"
                  {...props}
                />
              ) : (
                <code
                  className="block bg-slate-100 p-3 rounded text-sm font-mono text-slate-800 overflow-x-auto"
                  {...props}
                />
              ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }

  // Fallback for unknown formats
  return <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{content}</div>
}
