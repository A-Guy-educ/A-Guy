/**
 * @fileType component
 * @domain cody
 * @pattern preview-modal
 * @ai-summary Full-screen modal overlay showing PR preview: iframe, changes, docs, comments, actions
 */
'use client'

import { useState, useEffect } from 'react'
import type { CodyTask, FileChange, TaskDocument } from '../types'
import { prsApi, taskDocsApi } from '../api'
import { PreviewActions } from './PreviewActions'
import { PRCommentList } from './PRCommentList'
import { MarkdownViewer } from './MarkdownViewer'
import { cn } from '../utils'
import {
  ArrowLeft,
  GitPullRequest,
  ExternalLink,
  FileText,
  GitBranch,
  MessageSquare,
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/ui/web/components/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/ui/web/components/dialog'

type PreviewTab = 'changes' | 'docs' | 'comments'

interface PreviewModalProps {
  task: CodyTask
  onClose: () => void
  onMerge: () => Promise<void>
  isMerging: boolean
}

export function PreviewModal({ task, onClose, onMerge, isMerging }: PreviewModalProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>(() => {
    if (typeof window === 'undefined') return 'changes'
    const path = window.location.pathname
    if (path.endsWith('/docs')) return 'docs'
    if (path.endsWith('/comments')) return 'comments'
    return 'changes'
  })
  const [changes, setChanges] = useState<FileChange[]>([])
  const [documents, setDocuments] = useState<TaskDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<TaskDocument | null>(null)
  const [commentCount, setCommentCount] = useState<number | null>(null)

  const pr = task.associatedPR

  // URL sync for doc viewer dialog
  const openDoc = (doc: TaskDocument) => {
    setSelectedDoc(doc)
    const base = `/cody/${task.issueNumber}/preview/docs`
    window.history.pushState(null, '', `${base}?doc=${encodeURIComponent(doc.name)}`)
  }

  const closeDoc = () => {
    setSelectedDoc(null)
    window.history.pushState(null, '', `/cody/${task.issueNumber}/preview/docs`)
  }

  // Load tab data on demand
  useEffect(() => {
    if (!pr) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const loadData = async () => {
      try {
        if (activeTab === 'changes') {
          const files = await prsApi.files(pr.number)
          if (!cancelled) setChanges(files)
        } else if (activeTab === 'docs') {
          const branch = pr.head?.ref
          const docs = await taskDocsApi.list(task.id, branch)
          if (!cancelled) setDocuments(docs)
        }
        // comments tab loads its own data via PRCommentList
      } catch (err) {
        console.error('[PreviewModal] Error loading data:', err)
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [activeTab, pr, task.id])

  // Auto-open doc from URL ?doc= param
  useEffect(() => {
    if (documents.length === 0) return
    const docParam = new URLSearchParams(window.location.search).get('doc')
    if (docParam && !selectedDoc) {
      const match = documents.find((d) => d.name === docParam)
      if (match) setSelectedDoc(match)
    }
  }, [documents]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape — skip if selectedDoc is open (Dialog handles its own Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !selectedDoc) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, selectedDoc])

  // Sync tab + doc from URL on browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      // If navigated away from preview entirely, parent handles it
      if (!path.includes('/preview')) return

      // Sync tab
      if (path.endsWith('/docs')) setActiveTab('docs')
      else if (path.endsWith('/comments')) setActiveTab('comments')
      else setActiveTab('changes')

      // Sync doc dialog
      const docParam = new URLSearchParams(window.location.search).get('doc')
      if (docParam) {
        const match = documents.find((d) => d.name === docParam)
        setSelectedDoc(match || null)
      } else {
        setSelectedDoc(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [documents])

  if (!pr) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-zinc-400">No pull request associated with this task yet.</p>
          <Button variant="outline" onClick={onClose}>
            Back to task
          </Button>
        </div>
      </div>
    )
  }

  const prFilesUrl = `${pr.html_url}/files`
  const totalAdditions = changes.reduce((s, f) => s + f.additions, 0)
  const totalDeletions = changes.reduce((s, f) => s + f.deletions, 0)

  const tabs: Array<{ key: PreviewTab; label: string; icon: typeof GitBranch; count?: number }> = [
    { key: 'changes', label: 'Changes', icon: GitBranch },
    { key: 'docs', label: 'Docs', icon: BookOpen },
    { key: 'comments', label: 'Comments', icon: MessageSquare, count: commentCount ?? undefined },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-1.5 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="h-4 w-px bg-zinc-800" />

        <GitPullRequest className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="text-sm font-medium text-white truncate">PR #{pr.number}</span>
        <span className="text-sm text-zinc-500 truncate hidden sm:inline">{pr.title}</span>

        <div className="ml-auto flex items-center gap-2">
          {task.previewUrl && (
            <a
              href={task.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Preview
            </a>
          )}
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <GitPullRequest className="w-3 h-3" />
            GitHub
          </a>
        </div>
      </div>

      {/* Preview deployment banner */}
      {task.previewUrl && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-emerald-500/[0.04]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs text-emerald-400 font-medium truncate">Deployment ready</span>
            <span className="text-xs text-zinc-600 truncate hidden sm:inline">
              {task.previewUrl.replace(/^https?:\/\//, '')}
            </span>
          </div>
          <a
            href={task.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-colors shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            Open Preview
          </a>
        </div>
      )}

      {/* Tab bar */}
      <div role="tablist" className="shrink-0 flex border-b border-zinc-800 bg-zinc-950/50">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            role="tab"
            id={`preview-tab-${key}`}
            aria-selected={activeTab === key}
            aria-controls={`preview-panel-${key}`}
            onClick={() => {
              setActiveTab(key)
              const base = `/cody/${task.issueNumber}/preview`
              const path = key === 'changes' ? base : `${base}/${key}`
              window.history.pushState(null, '', path)
            }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
              activeTab === key
                ? 'text-white border-blue-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-700',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key === 'changes' && changes.length > 0 && (
              <span className="text-xs text-zinc-600 ml-1">{changes.length}</span>
            )}
            {key !== 'changes' && count !== undefined && count > 0 && (
              <span
                className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full tabular-nums ml-0.5',
                  activeTab === key ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-500',
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        {/* Changes tab */}
        {activeTab === 'changes' && (
          <div
            role="tabpanel"
            id="preview-panel-changes"
            aria-labelledby="preview-tab-changes"
            className="p-4"
          >
            {loadError ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {loadError}
                </div>
                <button
                  onClick={() => {
                    setLoadError(null)
                    setActiveTab('changes')
                  }}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              </div>
            ) : changes.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No file changes</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs text-zinc-500">
                    {changes.length} file{changes.length !== 1 ? 's' : ''} changed{' '}
                    <span className="text-green-500">+{totalAdditions}</span>{' '}
                    <span className="text-red-500">-{totalDeletions}</span>
                  </span>
                  <a
                    href={prFilesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    View diffs on GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="space-y-0.5">
                  {changes.map((file) => (
                    <a
                      key={file.filename}
                      href={prFilesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded text-left group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'text-xs font-mono',
                            file.status === 'added'
                              ? 'text-green-400'
                              : file.status === 'removed'
                                ? 'text-red-400'
                                : 'text-yellow-400',
                          )}
                        >
                          {file.status === 'added' ? 'A' : file.status === 'removed' ? 'D' : 'M'}
                        </span>
                        <span className="text-sm truncate group-hover:text-blue-400">
                          {file.filename}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 shrink-0">
                        <span className="text-green-500">+{file.additions}</span>
                        <span className="text-red-500">-{file.deletions}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Docs tab */}
        {activeTab === 'docs' && (
          <div
            role="tabpanel"
            id="preview-panel-docs"
            aria-labelledby="preview-tab-docs"
            className="p-4"
          >
            {loadError ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {loadError}
                </div>
                <button
                  onClick={() => {
                    setLoadError(null)
                    setActiveTab('docs')
                  }}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              </div>
            ) : documents.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No documents found</p>
            ) : (
              <>
                <div className="space-y-1">
                  {documents.map((doc) => (
                    <button
                      key={doc.name}
                      onClick={() => openDoc(doc)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-zinc-800/50 rounded text-left border border-zinc-800"
                    >
                      <FileText className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm">{doc.name}</span>
                    </button>
                  ))}
                </div>

                <Dialog
                  open={!!selectedDoc}
                  onOpenChange={(open) => {
                    if (!open) closeDoc()
                  }}
                >
                  <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>{selectedDoc?.name}</DialogTitle>
                      <DialogDescription className="sr-only">
                        Task document content
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {selectedDoc && (
                        <MarkdownViewer content={selectedDoc.content} title={selectedDoc.name} />
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}

        {/* Comments tab */}
        {activeTab === 'comments' && (
          <div
            role="tabpanel"
            id="preview-panel-comments"
            aria-labelledby="preview-tab-comments"
            className="p-4"
          >
            <PRCommentList prNumber={pr.number} onCountChange={setCommentCount} />
          </div>
        )}
      </div>

      {/* Action bar */}
      <PreviewActions task={task} onMerge={onMerge} isMerging={isMerging} onCancelPR={onClose} />
    </div>
  )
}
