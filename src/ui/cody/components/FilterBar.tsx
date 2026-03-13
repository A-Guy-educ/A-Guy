/**
 * @fileType component
 * @domain cody
 * @pattern filter-bar
 * @ai-summary Dedicated filter sub-header bar for Cody dashboard with view toggle, date, status, and label filters
 */
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import { cn } from '../utils'
import { Search } from 'lucide-react'

export type ViewMode = 'running' | 'backlog'

const DATE_FILTERS = [
  { label: 'All time', value: 'all', days: undefined },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
] as const

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Backlog', value: 'open' },
  { label: 'Building', value: 'building' },
  { label: 'In Review', value: 'review' },
  { label: 'Failed', value: 'failed' },
  { label: 'Gate Waiting', value: 'gate-waiting' },
  { label: 'Retrying', value: 'retrying' },
  { label: 'Done', value: 'done' },
] as const

export interface FilterBarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  dateFilter: string
  onDateFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  labelFilter: string
  onLabelFilterChange: (value: string) => void
  availableLabels: string[]
  labelCounts: Record<string, number>
  statusCounts: Record<string, number>
  totalCount: number
  filteredCount: number
  runningCount: number
  backlogCount: number
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

export { DATE_FILTERS, STATUS_FILTERS }

/** Pill-style toggle between Running and Backlog views */
export function ViewToggle({
  viewMode,
  onViewModeChange,
  runningCount,
  backlogCount,
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  runningCount: number
  backlogCount: number
}) {
  return (
    <div className="inline-flex items-center rounded-md bg-white/[0.04] p-0.5 gap-0.5">
      <button
        type="button"
        onClick={() => onViewModeChange('running')}
        className={cn(
          'px-3 py-1 rounded text-xs font-medium transition-colors',
          viewMode === 'running'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
        )}
      >
        Running ({runningCount})
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('backlog')}
        className={cn(
          'px-3 py-1 rounded text-xs font-medium transition-colors',
          viewMode === 'backlog'
            ? 'bg-zinc-600 text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
        )}
      >
        Backlog ({backlogCount})
      </button>
    </div>
  )
}

export function FilterBar({
  viewMode,
  onViewModeChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
  labelFilter,
  onLabelFilterChange,
  availableLabels,
  labelCounts,
  statusCounts,
  totalCount,
  filteredCount,
  runningCount,
  backlogCount,
  searchQuery = '',
  onSearchChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-white/[0.06] bg-white/[0.02]">
      {/* View toggle — Running / Backlog */}
      <ViewToggle
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        runningCount={runningCount}
        backlogCount={backlogCount}
      />

      {/* Search input */}
      {onSearchChange && (
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks…"
            className="h-8 pl-8 pr-3 text-xs rounded-md bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-white/20 w-40"
          />
        </div>
      )}

      {/* Date filter */}
      <Select value={dateFilter} onValueChange={onDateFilterChange}>
        <SelectTrigger className="w-full md:w-36">
          <SelectValue placeholder="Filter by date" />
        </SelectTrigger>
        <SelectContent>
          {DATE_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full md:w-36">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label} ({f.value === 'all' ? totalCount : statusCounts[f.value] || 0})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Label filter */}
      <Select value={labelFilter} onValueChange={onLabelFilterChange}>
        <SelectTrigger className="w-full md:w-36">
          <SelectValue placeholder="Filter by label" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All ({totalCount})</SelectItem>
          {availableLabels.map((label) => (
            <SelectItem key={label} value={label}>
              {label} ({labelCounts[label] || 0})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Task count indicator */}
      <span className="text-xs text-muted-foreground ml-auto">
        {filteredCount} of {totalCount} tasks
      </span>
    </div>
  )
}
