/**
 * @fileType component
 * @domain cody
 * @pattern file-diff-viewer
 * @ai-summary Syntax-highlighted diff viewer for file changes
 */
'use client'

import type { FileChange } from '../types'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface FileDiffViewerProps {
  file: FileChange
}

export function FileDiffViewer({ file }: FileDiffViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (file.patch) {
      await navigator.clipboard.writeText(file.patch)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Parse the patch into lines
  const lines = file.patch ? file.patch.split('\n') : []

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-xs font-mono shrink-0 ${
              file.status === 'added'
                ? 'text-green-400'
                : file.status === 'removed'
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {file.status === 'added' ? 'A' : file.status === 'removed' ? 'D' : 'M'}
          </span>
          <span className="text-sm font-medium truncate">{file.filename}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            <span className="text-green-500">+{file.additions}</span>
            {' / '}
            <span className="text-red-500">-{file.deletions}</span>
          </span>
          {file.patch && (
            <button onClick={handleCopy} className="p-1 hover:bg-muted rounded" title="Copy diff">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Diff Content */}
      {lines.length > 0 ? (
        <div className="overflow-x-auto">
          <pre className="text-xs font-mono p-2 bg-background">
            {lines.map((line, i) => {
              // Determine line type
              let lineClass = ''
              if (line.startsWith('+')) {
                lineClass = 'bg-green-500/10 text-green-400'
              } else if (line.startsWith('-')) {
                lineClass = 'bg-red-500/10 text-red-400'
              } else if (line.startsWith('@@')) {
                lineClass = 'text-blue-400 bg-blue-500/10'
              } else {
                lineClass = 'text-muted-foreground'
              }

              return (
                <div key={i} className={`${lineClass} px-2 py-0.5 hover:bg-muted/30`}>
                  <span className="inline-block w-8 text-center text-muted-foreground/50 select-none">
                    {i + 1}
                  </span>
                  <span className="ml-2">{line}</span>
                </div>
              )
            })}
          </pre>
        </div>
      ) : (
        <div className="p-4 text-center text-muted-foreground text-sm">
          No diff available (file too large or binary)
        </div>
      )}
    </div>
  )
}
