/**
 * @fileType component
 * @domain cody
 * @pattern comment-editor
 * @ai-summary Enhanced comment editor with markdown preview and @mention support
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/ui/web/components/button'
import { Textarea } from '@/ui/web/components/textarea'
import { cn } from '@/infra/utils/ui'

interface CommentEditorProps {
  issueNumber: number
  onCommentPosted?: () => void
  placeholder?: string
}

interface Mention {
  login: string
  avatar_url: string
}

// Common emojis for the picker
const EMOJI_LIST = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '🤣',
  '😂',
  '🙂',
  '🙃',
  '😉',
  '😊',
  '😇',
  '🥰',
  '😍',
  '🤩',
  '😘',
  '😗',
  '😚',
  '😙',
  '🥲',
  '😋',
  '😛',
  '😜',
  '🤪',
  '😝',
  '🤑',
  '🤗',
  '🤭',
  '🤫',
  '🤔',
  '🤐',
  '🤨',
  '😐',
  '😑',
  '😶',
  '😏',
  '😒',
  '🙄',
  '😬',
  '😮‍💨',
  '🤥',
  '😌',
  '😔',
  '😪',
  '🤤',
  '😴',
  '😷',
  '👍',
  '👎',
  '👌',
  '✌️',
  '🤞',
  '🤟',
  '🤘',
  '🤙',
  '👈',
  '👉',
  '👆',
  '👇',
  '☝️',
  '👋',
  '🤚',
  '🖐️',
  '✋',
  '🖖',
  '👏',
  '🙌',
  '🤲',
  '🤝',
  '🙏',
  '✍️',
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '💔',
  '❣️',
  '💕',
  '💞',
  '💓',
  '💗',
  '💖',
  '💘',
  '🚀',
  '⭐',
  '🌟',
  '✨',
  '💫',
  '🔥',
  '💥',
  '💯',
  '✅',
  '❌',
  '⚠️',
  '❓',
  '❗',
  '💡',
  '🔔',
  '🎉',
]

export function CommentEditor({
  issueNumber,
  onCommentPosted,
  placeholder = 'Write a comment...',
}: CommentEditorProps) {
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionsRef = useRef<HTMLDivElement>(null)

  // Fetch collaborators for @mentions
  useEffect(() => {
    async function fetchCollaborators() {
      try {
        const res = await fetch('/api/cody/collaborators')
        const data = await res.json()
        setMentions(data.collaborators || [])
      } catch (err) {
        console.error('Failed to fetch collaborators:', err)
      }
    }
    fetchCollaborators()
  }, [])

  // Filter mentions based on input
  const filteredMentions = mentions
    .filter((m) => m.login.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 5)

  // Handle @mention detection
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setComment(value)

    // Check for @ trigger
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1])
      setShowMentions(true)
      setSelectedMentionIndex(0)
    } else {
      setShowMentions(false)
      setMentionQuery('')
    }
  }

  // Handle mention selection
  const selectMention = (mention: Mention) => {
    const cursorPos = textareaRef.current?.selectionStart || comment.length
    const textBeforeCursor = comment.slice(0, cursorPos)
    const textAfterCursor = comment.slice(cursorPos)

    // Replace @query with @login
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${mention.login} `)
    setComment(newTextBefore + textAfterCursor)
    setShowMentions(false)
    setMentionQuery('')

    // Focus back on textarea
    textareaRef.current?.focus()
  }

  // Handle keyboard navigation in mentions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedMentionIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredMentions[selectedMentionIndex]) {
          selectMention(filteredMentions[selectedMentionIndex])
        }
        break
      case 'Escape':
        setShowMentions(false)
        break
    }
  }

  const handleSubmit = async () => {
    if (!comment.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/cody/tasks/issue-${issueNumber}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          comment: comment.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to post comment')
      }

      setComment('')
      setShowPreview(false)
      onCommentPosted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setLoading(false)
    }
  }

  // Common markdown helpers
  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = comment.slice(start, end)

    const newComment = comment.slice(0, start) + before + selectedText + after + comment.slice(end)
    setComment(newComment)

    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border border-border rounded-md p-1.5 bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('**', '**')}
          className="h-7 w-7 p-0 font-bold text-sm"
          title="Bold"
        >
          B
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('*', '*')}
          className="h-7 w-7 p-0 italic text-sm"
          title="Italic"
        >
          I
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('`', '`')}
          className="h-7 w-7 p-0 font-mono text-xs"
          title="Code"
        >
          {'</>'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('[', '](url)')}
          className="h-7 w-7 p-0 text-sm"
          title="Link"
        >
          🔗
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertMarkdown('- ')}
          className="h-7 w-7 p-0 text-sm"
          title="List"
        >
          •
        </Button>

        {/* Image URL button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter image URL:')
            if (url) {
              insertMarkdown('![image](', ')')
              // Insert URL after the opening parenthesis
              const textarea = textareaRef.current
              if (textarea) {
                const pos = textarea.selectionStart
                const newComment = comment.slice(0, pos) + url + comment.slice(pos)
                setComment(newComment)
              }
            }
          }}
          className="h-7 w-7 p-0 text-sm"
          title="Image"
        >
          🖼️
        </Button>

        {/* Emoji picker button */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="h-7 w-7 p-0 text-sm"
            title="Emoji"
          >
            😊
          </Button>

          {/* Emoji picker dropdown */}
          {showEmojiPicker && (
            <div className="absolute z-20 top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto border border-border rounded-md shadow-lg bg-popover p-2 grid grid-cols-8 gap-1">
              {EMOJI_LIST.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    insertMarkdown(emoji, '')
                    setShowEmojiPicker(false)
                  }}
                  className="p-1 hover:bg-accent rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          type="button"
          variant={showPreview ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="h-7 text-xs"
        >
          {showPreview ? 'Edit' : 'Preview'}
        </Button>
      </div>

      {/* Editor / Preview */}
      <div className="relative">
        {showPreview ? (
          <div className="min-h-[100px] p-3 border border-border rounded-md bg-background text-sm prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{comment || '*Nothing to preview*'}</ReactMarkdown>
          </div>
        ) : (
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={comment}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={4}
              disabled={loading}
              className="resize-none"
            />

            {/* @mentions dropdown */}
            {showMentions && filteredMentions.length > 0 && (
              <div
                ref={mentionsRef}
                className="absolute z-10 w-64 max-h-48 overflow-y-auto border border-border rounded-md shadow-lg bg-popover"
              >
                {filteredMentions.map((mention, index) => (
                  <button
                    key={mention.login}
                    type="button"
                    onClick={() => selectMention(mention)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-accent',
                      index === selectedMentionIndex && 'bg-accent',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mention.avatar_url}
                      alt={mention.login}
                      className="h-6 w-6 rounded-full"
                    />
                    <span className="text-sm">{mention.login}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error and submit */}
      <div className="flex justify-between items-center">
        {error && <span className="text-destructive text-sm">{error}</span>}
        <div className="ms-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Markdown • @mention • 😊 • 🖼️</span>
          <Button onClick={handleSubmit} disabled={loading || !comment.trim()} size="sm">
            {loading ? 'Posting...' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}
