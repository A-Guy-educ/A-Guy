/**
 * @fileType component
 * @domain cody
 * @pattern task-preview-tab
 * @ai-summary Changes tab links to GitHub diffs; Docs tab opens markdown in a modal dialog
 */
'use client'

import { useState, useEffect } from 'react'
import type { CodyTask, FileChange, TaskDocument } from '../types'
import { prsApi, taskDocsApi } from '../api'
import { MarkdownViewer } from './MarkdownViewer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/ui/web/components/dialog'
import { FileText, Loader2, ExternalLink } from 'lucide-react'

interface TaskPreviewTabProps {
  task: CodyTask
  activeTab: 'changes' | 'docs'
}

export function TaskPreviewTab({ task, activeTab }: TaskPreviewTabProps) {
  const [changes, setChanges] = useState<FileChange[]>([])
  const [documents, setDocuments] = useState<TaskDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<TaskDocument | null>(null)

  // Load data on demand when tab changes
  useEffect(() => {
    let cancelled = false
    setError(null)

    const loadData = async () => {
      setLoading(true)
      try {
        if (activeTab === 'changes') {
          if (!task.associatedPR) return
          const files = await prsApi.files(task.associatedPR.number)
          if (!cancelled) setChanges(files)
        } else if (activeTab === 'docs') {
          // Pass the PR branch so the API can find docs without branch discovery
          const branch = task.associatedPR?.head?.ref
          const docs = await taskDocsApi.list(task.id, branch)
          if (!cancelled) setDocuments(docs)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[TaskPreviewTab] Error loading data:', err)
          setError(err instanceof Error ? err.message : 'Failed to load data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [activeTab, task.associatedPR, task.id])

  const hasPR = !!task.associatedPR
  const prFilesUrl = hasPR ? `${task.associatedPR!.html_url}/files` : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  // ── Changes tab ──────────────────────────────────

  if (activeTab === 'changes') {
    if (!hasPR) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No PR created yet</p>
        </div>
      )
    }
    if (changes.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No file changes</p>
        </div>
      )
    }

    const totalAdditions = changes.reduce((s, f) => s + f.additions, 0)
    const totalDeletions = changes.reduce((s, f) => s + f.deletions, 0)

    return (
      <div className="space-y-2">
        {/* Summary + link to GitHub */}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-muted-foreground">
            {changes.length} file{changes.length !== 1 ? 's' : ''} changed{' '}
            <span className="text-green-500">+{totalAdditions}</span>{' '}
            <span className="text-red-500">-{totalDeletions}</span>
          </span>
          {prFilesUrl && (
            <a
              href={prFilesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              View diffs on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* File list — click opens GitHub PR files page */}
        <div className="space-y-0.5 overflow-y-auto max-h-[500px]">
          {changes.map((file) => (
            <a
              key={file.filename}
              href={prFilesUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded text-left group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-xs font-mono ${
                    file.status === 'added'
                      ? 'text-green-400'
                      : file.status === 'removed'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                  }`}
                >
                  {file.status === 'added' ? 'A' : file.status === 'removed' ? 'D' : 'M'}
                </span>
                <span className="text-sm truncate group-hover:text-blue-400">{file.filename}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <span className="text-green-500">+{file.additions}</span>
                <span className="text-red-500">-{file.deletions}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />
              </div>
            </a>
          ))}
        </div>
      </div>
    )
  }

  // ── Docs tab ─────────────────────────────────────

  if (activeTab === 'docs') {
    if (documents.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No documents found</p>
        </div>
      )
    }

    return (
      <>
        <div className="space-y-1 overflow-y-auto max-h-[500px]">
          {documents.map((doc) => (
            <button
              key={doc.name}
              onClick={() => setSelectedDoc(doc)}
              className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 rounded text-left border border-border"
            >
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{doc.name}</span>
            </button>
          ))}
        </div>

        {/* Document viewer modal */}
        <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedDoc?.name}</DialogTitle>
              <DialogDescription className="sr-only">Task document content</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto min-h-0">
              {selectedDoc && (
                <MarkdownViewer content={selectedDoc.content} title={selectedDoc.name} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return null
}
