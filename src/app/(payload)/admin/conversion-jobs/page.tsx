/**
 * Conversion Jobs Dashboard Page
 *
 * @fileType page
 * @domain admin
 * @pattern admin-page
 * @ai-summary Standalone dashboard for managing PDF-to-exercises conversion jobs
 */
'use client'

export default function ConversionJobsPage() {
  return (
    <div className="conversion-jobs-dashboard">
      <header className="page-header">
        <h1>PDF Conversion Jobs</h1>
        <p>Manage and monitor PDF to exercises conversion jobs</p>
      </header>
      <div className="dashboard-placeholder">
        <p>Dashboard coming soon...</p>
        <p>Use the API endpoints to manage jobs:</p>
        <ul>
          <li>
            <code>GET /api/jobs/list</code> - List all jobs
          </li>
          <li>
            <code>GET /api/jobs/[jobId]/stream</code> - Stream job logs via SSE
          </li>
          <li>
            <code>POST /api/jobs/cancel</code> - Cancel a queued job
          </li>
          <li>
            <code>POST /api/jobs/retry</code> - Retry a failed or completed job
          </li>
          <li>
            <code>GET /api/jobs/count</code> - Count jobs by filter
          </li>
        </ul>
      </div>
    </div>
  )
}
