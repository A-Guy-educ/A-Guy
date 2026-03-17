/**
 * @fileType component
 * @domain cody
 * @pattern filter-bar
 * @ai-summary Dedicated filter sub-header bar for Cody dashboard with view toggle, date, status, and label filters
 */
'use client'

import { forwardRef, useImperativeHandle, useRef } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'
import { cn } from '../utils'
import { Search, ArrowUp, ArrowDown } from 'lucide-react'
import type { SortField, SortDirection } from '../types'

export type ViewMode = 'running' | 'backlog' | 'queue'

const SORT_OPTIONS = [
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Created', value: 'createdAt' },
  { label: 'Issue #', value: 'issueNumber' },
  { label: 'Status', value: 'column' },
  { label: 'Risk', value: 'riskLevel' },
  { label: 'Progress', value: 'pipelineProgress' },
  { label: 'Assignee', value: 'assignee' },
  { label: 'Title', value: 'title' },
  { label: 'Label', value: 'label' },
] as const

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
  { label: 'Needs Approval', value: 'gate-waiting' },
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
  queueCount?: number
  searchQuery?: string
  onSearchChange?: (value: string) => void
  sortField?: SortField
  onSortFieldChange?: (field: SortField) => void
  sortDirection?: SortDirection
  onSortDirectionChange?: (direction: SortDirection) => void
}

export interface FilterBarHandle {
  focusSearch: () => void
}

export { DATE_FILTERS, STATUS_FILTERS }

/** Pill-style toggle between Running, Backlog, and Queue views */
export function ViewToggle({
  viewMode,
  onViewModeChange,
  runningCount,
  backlogCount,
  queueCount,
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  runningCount: number
  backlogCount: number
  queueCount?: number
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
      {queueCount !== undefined && (
        <button
          type="button"
          onClick={() => onViewModeChange('queue')}
          className={cn(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            viewMode === 'queue'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
          )}
        >
          Queue ({queueCount})
        </button>
      )}
    </div>
  )
}

export const FilterBar = forwardRef<FilterBarHandle, FilterBarProps>(function FilterBar(
  {
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
    queueCount,
    searchQuery = '',
    onSearchChange,
    sortField = 'updatedAt',
    onSortFieldChange,
    sortDirection = 'desc',
    onSortDirectionChange,
  },
  ref,
) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus()
    },
  }))

  return (
    <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-white/[0.06] bg-white/[0.02]">
      {/* View toggle — Running / Backlog */}
      <ViewToggle
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        runningCount={runningCount}
        backlogCount={backlogCount}
        queueCount={queueCount}
      />

      {/* Search input */}
      {onSearchChange && (
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
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

      {/* Sort control */}
      {onSortFieldChange && onSortDirectionChange && (
        <>
          <Select value={sortField} onValueChange={(v) => onSortFieldChange(v as SortField)}>
            <SelectTrigger className="w-full md:w-32">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="h-8 w-8 rounded-md border border-white/[0.08] bg-white/[0.04] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5" />
            )}
          </button>
        </>
      )}

      {/* Task count indicator */}
      <span className="text-xs text-muted-foreground ml-auto">
        {filteredCount} of {totalCount} tasks
      </span>
    </div>
  )
})
