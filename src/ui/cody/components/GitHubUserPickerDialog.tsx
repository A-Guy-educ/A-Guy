/**
 * @fileType component
 * @domain cody
 * @pattern github-identity-picker
 * @ai-summary Forced modal dialog for selecting your GitHub identity on first visit
 */
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/web/components/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import { Input } from '@/ui/web/components/input'
import { Loader2 } from 'lucide-react'
import type { GitHubCollaborator } from '../types'

interface GitHubUserPickerDialogProps {
  open: boolean
  collaborators: GitHubCollaborator[]
  isLoading: boolean
  onSelect: (user: GitHubCollaborator) => void
}

export function GitHubUserPickerDialog({
  open,
  collaborators,
  isLoading,
  onSelect,
}: GitHubUserPickerDialogProps) {
  const [search, setSearch] = useState('')

  const filtered = collaborators.filter((user) =>
    user.login.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Dialog open={open}>
      <DialogContent allowDismiss={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Who are you?</DialogTitle>
          <DialogDescription>
            Select your GitHub account to attribute your dashboard actions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {collaborators.length > 5 && (
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
                autoFocus
              />
            )}

            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No collaborators found
                </p>
              ) : (
                filtered.map((user) => (
                  <button
                    key={user.login}
                    type="button"
                    onClick={() => onSelect(user)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors text-left w-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url} alt={user.login} />
                      <AvatarFallback>{user.login[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.login}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
