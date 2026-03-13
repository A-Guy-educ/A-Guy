/**
 * @fileType component
 * @domain cody
 * @pattern preview-actions
 * @ai-summary Sticky action bar for Preview: Merge, Cancel PR, Fix
 */
'use client'

import { useState } from 'react'
import type { CodyTask } from '../types'
import { Button } from '@/ui/web/components/button'
import { MergeButton } from './MergeButton'
import { FixRequestDialog } from './FixRequestDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { XCircle, Wrench, Loader2 } from 'lucide-react'
import { tasksApi } from '../api'
import { useGitHubIdentity } from '../hooks/useGitHubIdentity'
import { toast } from 'sonner'
import { cn } from '../utils'

interface PreviewActionsProps {
  task: CodyTask
  onMerge: () => Promise<void>
  isMerging: boolean
  onCancelPR: () => void
  className?: string
}

export function PreviewActions({
  task,
  onMerge,
  isMerging,
  onCancelPR,
  className,
}: PreviewActionsProps) {
  const [showFixDialog, setShowFixDialog] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const { githubUser } = useGitHubIdentity()

  const pr = task.associatedPR
  if (!pr) return null

  const handleCancelPR = async () => {
    setIsCancelling(true)
    try {
      await tasksApi.closePR(task.issueNumber, githubUser?.login)
      toast.success('PR closed')
      onCancelPR()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to close PR')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleFixSubmit = async (description: string) => {
    try {
      await tasksApi.fixRequest(task.issueNumber, description, githubUser?.login)
      toast.success('Fix requested — Cody will work on it')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to request fix')
      throw err // re-throw so dialog keeps open
    }
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-sm',
          className,
        )}
      >
        {/* Merge */}
        <div className="flex items-center gap-1.5">
          <MergeButton
            prNumber={pr.number}
            prTitle={pr.title}
            branchName={pr.head.ref}
            isMerging={isMerging}
            onMerge={onMerge}
          />
          <span className="text-xs text-zinc-500 hidden sm:inline">Merge</span>
        </div>

        {/* Fix */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFixDialog(true)}
          className="gap-1.5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
        >
          <Wrench className="w-3.5 h-3.5" />
          Fix
        </Button>

        {/* Cancel PR */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelConfirm(true)}
          disabled={isCancelling}
          className="gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10 ml-auto"
        >
          {isCancelling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Cancel PR
        </Button>
      </div>

      <FixRequestDialog
        isOpen={showFixDialog}
        onClose={() => setShowFixDialog(false)}
        onSubmit={handleFixSubmit}
        prNumber={pr.number}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title="Close PR"
        description="Close this PR? The branch will remain but the PR will be closed."
        confirmLabel="Close PR"
        variant="destructive"
        onConfirm={handleCancelPR}
        onClose={() => setShowCancelConfirm(false)}
      />
    </>
  )
}
