/**
 * New Conversion Page
 *
 * Route for creating new PDF-to-exercises conversions
 * Supports URL query params for pre-populating from lesson conversion:
 * - lessonId: Pre-select a lesson
 * - mediaId: Pre-select a media/PDF file
 * - templateId: Pre-populate from a template
 *
 * @fileType page
 * @domain admin
 * @pattern page-route
 * @ai-summary Route page for starting new conversions
 */

import { ConversionWizard } from '@/ui/admin/conversion-jobs/wizard/ConversionWizard'

interface NewConversionPageProps {
  searchParams: Promise<{
    lessonId?: string
    mediaId?: string
    templateId?: string
  }>
}

export default async function NewConversionPage({ searchParams }: NewConversionPageProps) {
  const params = await searchParams
  return (
    <div className="new-conversion-page">
      <header className="page-header">
        <div className="header-content">
          <h1>New Conversion</h1>
          <p className="page-description">Create a new PDF to exercises conversion</p>
        </div>
      </header>

      <ConversionWizard initialLessonId={params.lessonId} initialMediaId={params.mediaId} />

      <style>{`
        .new-conversion-page { padding: 1.5rem; max-width: 1000px; margin: 0 auto; }
        .page-header { margin-bottom: 2rem; }
        .page-header h1 { font-size: 1.75rem; font-weight: 600; margin: 0; }
        .page-description { color: var(--theme-elevation-500); margin-top: 0.5rem; }
      `}</style>
    </div>
  )
}
