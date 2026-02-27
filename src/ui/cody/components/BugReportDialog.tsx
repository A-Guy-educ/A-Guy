/**
 * @fileType component
 * @domain cody
 * @pattern bug-report-dialog
 * @ai-summary Dialog to report bugs with structured template
 */
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/ui/web/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { Input } from '@/ui/web/components/input'
import { Label } from '@/ui/web/components/label'
import { Textarea } from '@/ui/web/components/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { codyApi } from '../api'

interface BugReportDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function BugReportDialog({ open, onClose, onCreated }: BugReportDialogProps) {
  // Title field
  const [title, setTitle] = useState('')

  // Environment fields
  const [environment, setEnvironment] = useState('dev')
  const [branch, setBranch] = useState('')
  const [browser, setBrowser] = useState('')
  const [userRole, setUserRole] = useState('')

  // Preconditions
  const [preconditions, setPreconditions] = useState('')

  // Steps to reproduce
  const [steps, setSteps] = useState('')

  // Expected result
  const [expectedResult, setExpectedResult] = useState('')

  // Actual result
  const [actualResult, setActualResult] = useState('')

  // Scope & Impact
  const [affects, setAffects] = useState('single')
  const [isBlocking, setIsBlocking] = useState(false)
  const [isRegression, setIsRegression] = useState(false)
  const [sinceVersion, setSinceVersion] = useState('')

  // Suspected area
  const [suspectedArea, setSuspectedArea] = useState('')

  // Reproducibility
  const [reproducibility, setReproducibility] = useState('always')

  const queryClient = useQueryClient()

  const createBug = useMutation({
    mutationFn: (data: { title: string; body: string; mode: string; labels?: string[] }) =>
      codyApi.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cody-tasks'] })
    },
  })

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle('')
      setEnvironment('dev')
      setBranch('')
      setBrowser('')
      setUserRole('')
      setPreconditions('')
      setSteps('')
      setExpectedResult('')
      setActualResult('')
      setAffects('single')
      setIsBlocking(false)
      setIsRegression(false)
      setSinceVersion('')
      setSuspectedArea('')
      setReproducibility('always')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Format body as markdown using the template
    const body = formatBugReport()

    createBug.mutate(
      { title, body, mode: 'bug', labels: ['bug'] },
      {
        onSuccess: () => {
          onCreated?.()
          onClose()
        },
      },
    )
  }

  const formatBugReport = () => {
    let report = '# 🐞 Bug Report\n\n'

    report += '## 1. Title\n'
    report += `${title}\n\n`

    report += '## 2. Environment\n'
    report += `- Environment: ${environment}\n`
    if (branch) report += `- Branch / Commit: ${branch}\n`
    if (browser) report += `- Browser / Device: ${browser}\n`
    if (userRole) report += `- User Role / Tenant: ${userRole}\n`
    report += '\n'

    report += '## 3. Preconditions\n'
    if (preconditions) {
      report += `${preconditions}\n`
    } else {
      report += '_None specified_\n'
    }
    report += '\n'

    report += '## 4. Steps to Reproduce\n'
    if (steps) {
      report += `${steps}\n`
    } else {
      report += '_None specified_\n'
    }
    report += '\n'

    report += '## 5. Expected Result\n'
    if (expectedResult) {
      report += `${expectedResult}\n`
    } else {
      report += '_Not specified_\n'
    }
    report += '\n'

    report += '## 6. Actual Result\n'
    if (actualResult) {
      report += `${actualResult}\n`
    } else {
      report += '_Not specified_\n'
    }
    report += '\n'

    report += '## 7. Scope & Impact\n'
    report += `- Affects: ${affects === 'single' ? 'single user' : 'all users'}\n`
    report += `- Blocking: ${isBlocking ? 'yes' : 'no'}\n`
    report += `- Regression: ${isRegression ? 'yes' : 'no'}\n`
    if (sinceVersion) report += `- Since version: ${sinceVersion}\n`
    report += '\n'

    report += '## 8. Suspected Area\n'
    if (suspectedArea) {
      report += `${suspectedArea}\n`
    } else {
      report += '_Unknown_\n'
    }
    report += '\n'

    report += '## 9. Reproducibility\n'
    report += `${reproducibility}\n`

    return report
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>Create a structured bug report for the team.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {createBug.error && (
            <div className="p-2 bg-destructive/10 text-destructive text-sm rounded">
              {createBug.error.message}
            </div>
          )}

          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="bug-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bug-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="[Area] Short description of failure"
              required
            />
            <p className="text-xs text-muted-foreground">Format: [Component] Short description</p>
          </div>

          {/* Environment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="environment">Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger id="environment">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Dev</SelectItem>
                  <SelectItem value="preview">Preview</SelectItem>
                  <SelectItem value="prod">Prod</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="browser">Browser / Device</Label>
              <Input
                id="browser"
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                placeholder="Chrome, iPhone, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="branch">Branch / Commit</Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="dev, main, commit hash"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="userRole">User Role / Tenant</Label>
              <Input
                id="userRole"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                placeholder="student, teacher, org-id"
              />
            </div>
          </div>

          {/* Preconditions */}
          <div className="grid gap-2">
            <Label htmlFor="preconditions">Preconditions</Label>
            <Textarea
              id="preconditions"
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              placeholder="What must exist for the bug to occur?"
              rows={2}
            />
          </div>

          {/* Steps to Reproduce */}
          <div className="grid gap-2">
            <Label htmlFor="steps">
              Steps to Reproduce <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="1. Go to...
2. Click...
3. See error"
              rows={4}
              required
            />
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="expected">Expected Result</Label>
              <Textarea
                id="expected"
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="What should happen?"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="actual">Actual Result</Label>
              <Textarea
                id="actual"
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                placeholder="What actually happened?"
                rows={2}
              />
            </div>
          </div>

          {/* Scope & Impact */}
          <div className="grid grid-cols-4 gap-2">
            <div className="grid gap-2">
              <Label>Affects</Label>
              <Select value={affects} onValueChange={setAffects}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Blocking</Label>
              <Select
                value={isBlocking ? 'yes' : 'no'}
                onValueChange={(v) => setIsBlocking(v === 'yes')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Regression</Label>
              <Select
                value={isRegression ? 'yes' : 'no'}
                onValueChange={(v) => setIsRegression(v === 'yes')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Since</Label>
              <Input
                value={sinceVersion}
                onChange={(e) => setSinceVersion(e.target.value)}
                placeholder="v1.0.0"
              />
            </div>
          </div>

          {/* Suspected Area */}
          <div className="grid gap-2">
            <Label htmlFor="suspected">Suspected Area (Optional)</Label>
            <Input
              id="suspected"
              value={suspectedArea}
              onChange={(e) => setSuspectedArea(e.target.value)}
              placeholder="Related component, file, collection, or API"
            />
          </div>

          {/* Reproducibility */}
          <div className="grid gap-2">
            <Label htmlFor="reproducibility">Reproducibility</Label>
            <Select value={reproducibility} onValueChange={setReproducibility}>
              <SelectTrigger id="reproducibility">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="sometimes">Sometimes</SelectItem>
                <SelectItem value="rare">Rare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createBug.isPending}>
              {createBug.isPending ? 'Creating...' : 'Report Bug'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
