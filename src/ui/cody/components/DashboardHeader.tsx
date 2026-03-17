/**
 * @fileType component
 * @domain cody
 * @pattern dashboard-header
 * @ai-summary Dashboard header with user info, theme toggle, and action buttons
 */
'use client'

import { useState } from 'react'
import { Button } from '@/ui/web/components/button'
import { RefreshCw, Bug, GitBranch, Sun, Moon } from 'lucide-react'
import { SimpleTooltip } from './SimpleTooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/web/components/avatar'

interface DashboardHeaderProps {
  /** Currently authenticated GitHub user */
  githubUser?: {
    login: string
    avatar_url: string
  } | null
  /** Callback to clear GitHub session */
  onClearGitHubUser?: () => void
  /** Current theme */
  theme?: 'light' | 'dark' | 'system'
  /** Callback to toggle theme */
  onThemeToggle?: () => void
  /** Callback for branch cleanup */
  onBranchCleanup?: () => void
  /** Callback for refresh */
  onRefresh?: () => void
  /** Whether refresh is in progress */
  isRefreshing?: boolean
  /** Callback for bug report */
  onBugReport?: () => void
  /** Callback for new task */
  onNewTask?: () => void
}

/**
 * Dashboard header component - extracted from CodyDashboard
 * Contains user info, theme toggle, and action buttons
 */
export function DashboardHeader({
  githubUser,
  onClearGitHubUser,
  theme,
  onThemeToggle,
  onBranchCleanup,
  onRefresh,
  isRefreshing = false,
  onBugReport,
  onNewTask,
}: DashboardHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: User info */}
      <div className="flex items-center gap-3">
        {githubUser ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
              aria-label="User menu"
            >
              <Avatar className="w-7 h-7">
                <AvatarImage src={githubUser.avatar_url} alt={githubUser.login} />
                <AvatarFallback className="text-xs">
                  {githubUser.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{githubUser.login}</span>
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute top-full left-0 mt-1 w-40 py-1 bg-popover border rounded-md shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => {
                    onClearGitHubUser?.()
                    setShowUserMenu(false)
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Not signed in</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <SimpleTooltip
          content={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          side="bottom"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onThemeToggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </SimpleTooltip>

        {/* Branch cleanup */}
        <SimpleTooltip content="Clean up branches" side="bottom">
          <Button
            variant="outline"
            size="sm"
            onClick={onBranchCleanup}
            aria-label="Clean up branches"
            className="gap-1"
          >
            <GitBranch className="w-4 h-4" />
            <span className="hidden sm:inline">Cleanup</span>
          </Button>
        </SimpleTooltip>

        {/* Refresh */}
        <SimpleTooltip content="Refresh tasks" side="bottom">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh tasks"
            className="gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </SimpleTooltip>

        {/* Bug report */}
        <SimpleTooltip content="Report a bug" side="bottom">
          <Button variant="outline" size="sm" onClick={onBugReport}>
            <Bug className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Report Bug</span>
          </Button>
        </SimpleTooltip>

        {/* New task */}
        <SimpleTooltip content="Create new task" side="bottom">
          <Button size="sm" onClick={onNewTask}>
            + New Task
          </Button>
        </SimpleTooltip>
      </div>
    </div>
  )
}
