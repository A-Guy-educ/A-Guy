/**
 * @fileType component
 * @domain cody
 * @pattern wizard-dialog
 * @ai-summary PRD preview dialog with GitHub issue creation
 */
'use client'

import { Button } from '@/ui/web/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { PRDCardContent } from './shared/PRDCardContent'
import type { Scenario, DSComponent } from '@/infra/qa/schema'

interface WizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenario: Partial<Scenario>
  selectedComponents: DSComponent[]
  onCreateGitHubIssue: () => Promise<void>
}

export function WizardDialog({
  open,
  onOpenChange,
  scenario,
  selectedComponents,
  onCreateGitHubIssue,
}: WizardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generated PRD</DialogTitle>
          <DialogDescription>Review and create a GitHub issue for this scenario</DialogDescription>
        </DialogHeader>
        <PRDCardContent scenario={scenario} selectedComponents={selectedComponents} />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onCreateGitHubIssue}>Create GitHub Issue</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
