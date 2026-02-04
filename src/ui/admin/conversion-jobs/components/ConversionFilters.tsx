/**
 * Conversion Jobs Filters
 *
 * @fileType component
 * @domain admin
 * @pattern filter-component
 * @ai-summary Filter controls for conversion jobs list
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export interface ConversionFiltersProps {
  className?: string
}

export function ConversionFilters({ className = '' }: ConversionFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentStatus = searchParams.get('status') || 'all'

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (status === 'all') {
      params.delete('status')
    } else {
      params.set('status', status)
    }
    params.delete('page') // Reset to first page on filter change
    router.push(`/admin/conversion-jobs?${params.toString()}`)
  }

  return (
    <div className={`conversion-filters ${className}`}>
      <label htmlFor="status-filter" className="filter-label">
        Status
      </label>
      <select
        id="status-filter"
        value={currentStatus}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="filter-select"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
