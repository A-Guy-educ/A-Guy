/**
 * @fileType component
 * @domain cody
 * @pattern filter-bar
 * @ai-summary Dedicated filter sub-header bar for Cody dashboard with date, status, and label filters
 */
'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/web/components/select'

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
}

export { DATE_FILTERS, STATUS_FILTERS }

export function FilterBar({
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
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-border bg-muted/30">
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
