/**
 * Conversion Jobs Dashboard Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Standalone dashboard for managing PDF-to-exercises conversion jobs
 */

'use client'

import { ConversionFilters } from '@/ui/admin/conversion-jobs/components/ConversionFilters'
import { ConversionStats } from '@/ui/admin/conversion-jobs/components/ConversionStats'
import { ConversionTable } from '@/ui/admin/conversion-jobs/components/ConversionTable'
import { Pagination } from '@/ui/admin/conversion-jobs/components/Pagination'
import { useConversionJobs } from '@/ui/admin/conversion-jobs/hooks/useConversionJobs'
import { useSearchParams } from 'next/navigation'

export default function ConversionJobsPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const { data, isLoading, error } = useConversionJobs({ status, page })

  if (error) {
    return (
      <div className="conversion-jobs-error">
        <h1>Error Loading Jobs</h1>
        <p>{error.message}</p>
        <p>Please try refreshing the page.</p>
      </div>
    )
  }

  return (
    <div className="conversion-jobs-dashboard">
      <header className="page-header">
        <div className="header-content">
          <h1>PDF Conversion Jobs</h1>
          <p>Manage and monitor PDF to exercises conversion jobs</p>
        </div>
      </header>

      {data?.docs && data.docs.length > 0 && <ConversionStats jobs={data.docs} />}

      <div className="dashboard-toolbar">
        <ConversionFilters />
      </div>

      <ConversionTable
        jobs={data?.docs || []}
        isLoading={isLoading}
        onRowClick={(job) => {
          window.location.href = `/admin/conversion-jobs/${job.id}`
        }}
      />

      {data && data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} />}

      <style>{`
        .conversion-jobs-dashboard {
          padding: 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
        }
        .page-header {
          margin-bottom: 1.5rem;
        }
        .page-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
        }
        .page-header p {
          color: var(--theme-elevation-500);
          margin: 0.25rem 0 0;
        }
        .dashboard-toolbar {
          margin-bottom: 1rem;
        }
        .conversion-jobs-error {
          padding: 3rem;
          text-align: center;
          color: var(--theme-error);
        }
        .conversion-jobs-error h1 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  )
}
