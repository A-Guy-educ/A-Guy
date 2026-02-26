/**
 * @fileType component
 * @domain cody
 * @pattern comment-editor
 * @ai-summary Simplified comment editor with markdown preview and @mention support
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { Button } from '@/ui/web/components/button'
import { Textarea } from '@/ui/web/components/textarea'
import { cn } from '@/infra/utils/ui'
import { usePostComment } from '../hooks'
import { EMOJI_LIST } from '../constants'

interface CommentEditorProps {
  issueNumber: number
  onCommentPosted?: () => void
  placeholder?: string
}

interface Mention {
  login: string
  avatar_url: string
}

export function CommentEditor({
  issueNumber,
  onCommentPosted,
  placeholder = 'Write a comment...',
}: CommentEditorProps) {
  const [comment, setComment] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionsRef = useRef<HTMLDivElement>(null)

  const { mutate: postComment, isPending: isPosting, error } = usePostComment(issueNumber)

  // Fetch collaborators for @mentions
  useEffect(() => {
    fetch('/api/cody/collaborators')
      .then((res) => res.json())
      .then((data) => setMentions(data.collaborators || []))
      .catch(console.error)
  }, [])

  // Filter mentions based on input
  const filteredMentions = mentions
    .filter((m) => m.login.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 5)

  // Handle @mention detection
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setComment(value)

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
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${mention.login} `)
    setComment(newTextBefore + textAfterCursor)
    setShowMentions(false)
    setMentionQuery('')
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

  const handleSubmit = () => {
    if (!comment.trim() || isPosting) return

    postComment(comment.trim(), {
      onSuccess: () => {
        setComment('')
        setShowPreview(false)
        onCommentPosted?.()
      },
    })
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

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const newComment = comment.slice(0, start) + emoji + comment.slice(start)
    setComment(newComment)
    setShowEmojiPicker(false)
    textarea.focus()
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

        {/* Emoji picker dropdown */}
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
          {showEmojiPicker && (
            <div className="absolute z-20 top-full left-0 mt-1 w-48 max-h-40 overflow-y-auto border border-border rounded-md shadow-lg bg-popover p-2 grid grid-cols-6 gap-1">
              {EMOJI_LIST.slice(0, 60).map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
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
              disabled={isPosting}
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
                      'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent',
                      index === selectedMentionIndex && 'bg-accent',
                    )}
                  >
                    <Image
                      src={mention.avatar_url}
                      alt={mention.login}
                      width={24}
                      height={24}
                      className="rounded-full"
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
        {error && <span className="text-destructive text-sm">{error.message}</span>}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Markdown • @mention</span>
          <Button onClick={handleSubmit} disabled={isPosting || !comment.trim()} size="sm">
            {isPosting ? 'Posting...' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}
