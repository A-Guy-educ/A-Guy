/**
 * @fileType component
 * @domain cody
 * @pattern task-detail-dialog
 * @ai-summary Wide dialog wrapper for TaskDetail on desktop, ~85vw centered
 */
'use client'

import type { CodyTask } from '../types'
import { TaskDetail } from './TaskDetail'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/web/components/dialog'

interface TaskDetailDialogProps {
  task: CodyTask | null
  open: boolean
  onClose: () => void
  onRefresh: () => void
}

export function TaskDetailDialog({ task, open, onClose, onRefresh }: TaskDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[85vw] w-[85vw] max-h-[90vh] h-[90vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>
        <TaskDetail task={task} onClose={onClose} onRefresh={onRefresh} />
      </DialogContent>
    </Dialog>
  )
}
