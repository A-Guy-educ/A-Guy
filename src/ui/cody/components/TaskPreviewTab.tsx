/**
 * @fileType component
 * @domain cody
 * @pattern task-preview-tab
 * @ai-summary Preview tab showing file changes with diff viewer and task documents with markdown viewer
 */
'use client'

import { useState, useEffect } from 'react'
import type { CodyTask, FileChange, TaskDocument } from '../types'
import { prsApi, taskDocsApi } from '../api'
import { FileDiffViewer } from './FileDiffViewer'
import { MarkdownViewer } from './MarkdownViewer'
import { FileText, Loader2, ArrowLeft } from 'lucide-react'

interface TaskPreviewTabProps {
  task: CodyTask
  activeTab: 'changes' | 'docs'
}

export function TaskPreviewTab({ task, activeTab }: TaskPreviewTabProps) {
  const [changes, setChanges] = useState<FileChange[]>([])
  const [documents, setDocuments] = useState<TaskDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<TaskDocument | null>(null)

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedFile(null)
    setSelectedDoc(null)
  }, [activeTab])

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
          const docs = await taskDocsApi.list(task.id)
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

    // Show diff viewer when a file is selected
    if (selectedFile) {
      return (
        <div className="space-y-2">
          <button
            onClick={() => setSelectedFile(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to file list
          </button>
          <FileDiffViewer file={selectedFile} />
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

    return (
      <div className="space-y-1 overflow-y-auto max-h-[500px]">
        {changes.map((file) => (
          <button
            key={file.filename}
            onClick={() => setSelectedFile(file)}
            className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded text-left"
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
                {file.status === 'added' ? '+' : file.status === 'removed' ? '-' : '~'}
              </span>
              <span className="text-sm truncate">{file.filename}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <span className="text-green-500">+{file.additions}</span>
              <span className="text-red-500">-{file.deletions}</span>
            </div>
          </button>
        ))}
      </div>
    )
  }

  // ── Docs tab ─────────────────────────────────────

  if (activeTab === 'docs') {
    // Show markdown viewer when a doc is selected
    if (selectedDoc) {
      return (
        <div className="space-y-2">
          <button
            onClick={() => setSelectedDoc(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to documents
          </button>
          <MarkdownViewer content={selectedDoc.content} title={selectedDoc.name} />
        </div>
      )
    }

    if (documents.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No documents found</p>
        </div>
      )
    }

    return (
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
    )
  }

  return null
}
