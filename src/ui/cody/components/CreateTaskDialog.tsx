/**
 * @fileType component
 * @domain cody
 * @pattern create-task-dialog
 * @ai-summary Dialog to create new tasks with useCreateTask hook
 */
'use client'

import { useState, useEffect, useRef } from 'react'
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
import ReactMarkdown from 'react-markdown'
import {
  Bold,
  Italic,
  Code,
  Link2,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Eye,
  Edit3,
} from 'lucide-react'

interface CreateTaskDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function CreateTaskDialog({ open, onClose, onCreated }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle('')
      setBody('')
      setShowPreview(false)
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

  // Markdown helper functions
  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = body.slice(start, end)
    const newBody = body.slice(0, start) + before + selectedText + after + body.slice(end)
    setBody(newBody)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[800px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Create a new Cody task in GitHub.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5 py-2">
          {createTask.error && (
            <div className="p-2 bg-destructive/10 text-destructive text-sm rounded">
              {createTask.error.message}
            </div>
          )}

          {/* Title */}
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

          {/* Description with Markdown Editor */}
          <div className="grid gap-2">
            <Label htmlFor="body">Description</Label>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 border border-border rounded-md p-1 bg-muted/30">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('**', '**')}
                className="h-7 w-7 p-0"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('*', '*')}
                className="h-7 w-7 p-0"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('`', '`')}
                className="h-7 w-7 p-0"
                title="Inline Code"
              >
                <Code className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('## ')}
                className="h-7 w-7 p-0"
                title="Heading"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('- ')}
                className="h-7 w-7 p-0"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('1. ')}
                className="h-7 w-7 p-0"
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('> ')}
                className="h-7 w-7 p-0"
                title="Quote"
              >
                <Quote className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => insertMarkdown('[', '](url)')}
                className="h-7 w-7 p-0"
                title="Link"
              >
                <Link2 className="w-3.5 h-3.5" />
              </Button>

              <div className="w-px h-4 bg-border mx-1" />

              <Button
                type="button"
                variant={showPreview ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-7 px-2"
                title={showPreview ? 'Edit' : 'Preview'}
              >
                {showPreview ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Edit</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Preview</span>
                  </>
                )}
              </Button>
            </div>

            {/* Editor / Preview */}
            {showPreview ? (
              <div className="min-h-[200px] p-3 border border-border rounded-md bg-background text-sm prose prose-sm dark:prose-invert max-w-none overflow-y-auto">
                <ReactMarkdown>{body || '*No description*'}</ReactMarkdown>
              </div>
            ) : (
              <Textarea
                ref={textareaRef}
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe what needs to be done... (Markdown supported)"
                rows={8}
                className="resize-none font-mono text-sm"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Supports Markdown: **bold**, *italic*, {'`'}code{'`'}, ## headings, - lists, {'>'}{' '}
              quotes, [links](url)
            </p>
          </div>

          {/* Mode and Labels row */}
          <div className="grid grid-cols-2 gap-4">
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
              <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                {availableLabels.length === 0 ? (
                  <span className="text-muted-foreground text-xs">No labels available</span>
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
          </div>

          {/* Assignees */}
          <div className="grid gap-2">
            <Label>Assignees</Label>
            <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
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
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
