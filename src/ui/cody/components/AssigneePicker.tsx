/**
 * @fileType component
 * @domain cody
 * @pattern assignee-picker
 * @ai-summary Dropdown component for assigning/unassigning users on issues
 */
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/ui/web/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/web/components/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'
import type { GitHubCollaborator } from '../types'

interface AssigneePickerProps {
  issueNumber: number
  currentAssignees: Array<{ login: string; avatar_url: string }>
  onChange?: () => void
}

export function AssigneePicker({ issueNumber, currentAssignees, onChange }: AssigneePickerProps) {
  const [collaborators, setCollaborators] = useState<GitHubCollaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function fetchCollaborators() {
      try {
        const res = await fetch('/api/cody/collaborators')
        const data = await res.json()
        setCollaborators(data.collaborators || [])
      } catch (err) {
        console.error('Failed to fetch collaborators:', err)
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      fetchCollaborators()
    }
  }, [open])

  const currentLogins = currentAssignees.map((a) => a.login)

  const handleAssign = async (login: string) => {
    try {
      const res = await fetch(`/api/cody/tasks/issue-${issueNumber}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          assignees: [login],
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to assign')
      }

      onChange?.()
    } catch (err) {
      console.error('Failed to assign:', err)
    }
  }

  const handleUnassign = async (login: string) => {
    try {
      const res = await fetch(`/api/cody/tasks/issue-${issueNumber}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unassign',
          assignees: [login],
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to unassign')
      }

      onChange?.()
    } catch (err) {
      console.error('Failed to unassign:', err)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Assignees
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {loading ? (
          <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
        ) : collaborators.length === 0 ? (
          <DropdownMenuItem disabled>No collaborators</DropdownMenuItem>
        ) : (
          <>
            {collaborators.map((user) => {
              const isAssigned = currentLogins.includes(user.login)
              return (
                <DropdownMenuItem
                  key={user.login}
                  onClick={() =>
                    isAssigned ? handleUnassign(user.login) : handleAssign(user.login)
                  }
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatar_url} alt={user.login} />
                    <AvatarFallback>{user.login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{user.login}</span>
                  {isAssigned && <span className="ml-auto text-xs">✓</span>}
                </DropdownMenuItem>
              )
            })}
          </>
        )}

        {currentAssignees.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              Current: {currentAssignees.map((a) => a.login).join(', ')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
