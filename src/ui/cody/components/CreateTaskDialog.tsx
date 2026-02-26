/**
 * @fileType component
 * @domain cody
 * @pattern create-task-dialog
 * @ai-summary Dialog to create new tasks with useCreateTask hook
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import { Textarea } from '@/ui/web/components/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { useCreateTask, useCodyBoards, useCollaborators } from '../hooks'

interface CreateTaskDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function CreateTaskDialog({ open, onClose, onCreated }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState('full')
  const [labels, setLabels] = useState<string[]>([])
  const [assignees, setAssignees] = useState<string[]>([])

  // Use hooks for data fetching
  const { data: collaborators = [] } = useCollaborators()
  const { data: boards = [] } = useCodyBoards()

  // Extract labels from boards
  const availableLabels = boards
    .filter((b) => b.type === 'label')
    .flatMap((b) => (b as { labels?: Array<{ name: string; color: string }> }).labels || [])
    .slice(0, 20)

  const createTask = useCreateTask()

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle('')
      setBody('')
      setMode('full')
      setLabels([])
      setAssignees([])
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    createTask.mutate(
      { title, body, mode, labels, assignees },
      {
        onSuccess: () => {
          onCreated?.()
          onClose()
        },
      },
    )
  }

  const toggleLabel = (label: string) => {
    setLabels((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]))
  }

  const toggleAssignee = (login: string) => {
    setAssignees((prev) =>
      prev.includes(login) ? prev.filter((a) => a !== login) : [...prev, login],
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Create a new Cody task in GitHub.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {createTask.error && (
            <div className="p-2 bg-destructive/10 text-destructive text-sm rounded">
              {createTask.error.message}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add user authentication"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="body">Description</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe what needs to be done..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="mode">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full (spec + impl)</SelectItem>
                <SelectItem value="spec">Spec only</SelectItem>
                <SelectItem value="impl">Implementation only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Labels */}
          <div className="grid gap-2">
            <Label>Labels</Label>
            <div className="flex flex-wrap gap-1">
              {availableLabels.length === 0 ? (
                <span className="text-muted-foreground text-sm">No labels available</span>
              ) : (
                availableLabels.slice(0, 10).map((label) => (
                  <Button
                    key={label.name}
                    type="button"
                    variant={labels.includes(label.name) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleLabel(label.name)}
                    className="text-xs h-6"
                  >
                    {label.name}
                  </Button>
                ))
              )}
            </div>
          </div>

          {/* Assignees */}
          <div className="grid gap-2">
            <Label>Assignees</Label>
            <div className="flex flex-wrap gap-1">
              {collaborators.length === 0 ? (
                <span className="text-muted-foreground text-sm">No collaborators available</span>
              ) : (
                collaborators.slice(0, 10).map((user) => (
                  <Button
                    key={user.login}
                    type="button"
                    variant={assignees.includes(user.login) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleAssignee(user.login)}
                    className="text-xs h-6 gap-1"
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={user.avatar_url} alt={user.login} />
                      <AvatarFallback>{user.login[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {user.login}
                  </Button>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createTask.isPending}>
              {createTask.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
