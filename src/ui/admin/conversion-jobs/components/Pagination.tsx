/**
 * Pagination Controls
 *
 * @fileType component
 * @domain admin
 * @pattern pagination
 * @ai-summary Pagination controls for list views
 */

'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface PaginationProps {
  page: number
  totalPages: number
  className?: string
}

export function Pagination({ page, totalPages, className = '' }: PaginationProps) {
  const searchParams = useSearchParams()

  const createPageUrl = (pageNum: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (pageNum <= 1) {
      params.delete('page')
    } else {
      params.set('page', pageNum.toString())
    }
    return `/admin/conversion-jobs?${params.toString()}`
  }

  if (totalPages <= 1) {
    return null
  }

  const pages = []
  const showPages = 5
  let startPage = Math.max(1, page - Math.floor(showPages / 2))
  const endPage = Math.min(totalPages, startPage + showPages - 1)

  if (endPage - startPage + 1 < showPages) {
    startPage = Math.max(1, endPage - showPages + 1)
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return (
    <nav className={`pagination ${className}`}>
      <Link
        href={createPageUrl(page - 1)}
        className={`pagination-link ${page <= 1 ? 'disabled' : ''}`}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
      >
        Previous
      </Link>

      {startPage > 1 && (
        <>
          <Link href={createPageUrl(1)} className="pagination-link">
            1
          </Link>
          {startPage > 2 && <span className="pagination-ellipsis">...</span>}
        </>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={createPageUrl(p)}
          className={`pagination-link ${p === page ? 'active' : ''}`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </Link>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
          <Link href={createPageUrl(totalPages)} className="pagination-link">
            {totalPages}
          </Link>
        </>
      )}

      <Link
        href={createPageUrl(page + 1)}
        className={`pagination-link ${page >= totalPages ? 'disabled' : ''}`}
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : undefined}
      >
        Next
      </Link>

      <style>{`
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.5rem;
        }
        .pagination-link {
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          background: var(--theme-elevation-100);
          color: var(--theme-elevation-800);
          text-decoration: none;
          font-size: 0.875rem;
          transition: background 0.15s;
        }
        .pagination-link:hover:not(.disabled):not(.active) {
          background: var(--theme-elevation-200);
        }
        .pagination-link.active {
          background: var(--theme-primary);
          color: white;
        }
        .pagination-link.disabled {
          opacity: 0.5;
          pointer-events: none;
        }
        .pagination-ellipsis {
          padding: 0.5rem;
          color: var(--theme-elevation-500);
        }
      `}</style>
    </nav>
  )
}
