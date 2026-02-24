/**
 * @fileType component
 * @domain cody
 * @pattern comment-list
 * @ai-summary Component to display comments with markdown rendering
 */
'use client'

import ReactMarkdown from 'react-markdown'
import { formatRelativeTime } from '../utils'
import type { GitHubComment } from '../types'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { cn } from '@/infra/utils/ui'

interface CommentListProps {
  comments: GitHubComment[]
  loading?: boolean
}

export function CommentList({ comments, loading }: CommentListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-muted" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
            <div className="h-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!comments || comments.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No comments yet</div>
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  )
}

function CommentItem({ comment }: { comment: GitHubComment }) {
  const isBot = comment.user.login.endsWith('[bot]')

  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        isBot ? 'bg-muted/50 border-muted' : 'bg-background border-border',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={comment.user.avatar_url} alt={comment.user.login} />
            <AvatarFallback className="text-xs">
              {comment.user.login[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'text-sm font-medium',
              isBot ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {comment.user.login}
            {isBot && <span className="ms-1 text-xs bg-muted px-1.5 py-0.5 rounded">BOT</span>}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>

      {/* Body - Rendered markdown */}
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
        <ReactMarkdown
          components={{
            // Custom code block rendering
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const isInline = !match

              if (isInline) {
                return (
                  <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <pre className="bg-muted p-2 rounded-md overflow-x-auto">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              )
            },
            // Custom link rendering
            a({ href, children, ...props }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  {...props}
                >
                  {children}
                </a>
              )
            },
          }}
        >
          {comment.body}
        </ReactMarkdown>
      </div>
    </div>
  )
}
