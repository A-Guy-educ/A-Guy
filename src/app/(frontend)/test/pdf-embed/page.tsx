/**
 * PDF Embed Test Page
 *
 * Route: /test/pdf-embed?url=<encoded_url>&title=<encoded_title>
 *
 * Used for testing PDF loading in iframes, specifically to reproduce
 * X-Frame-Options blocking issues.
 */

import { PDFEmbed } from '@/ui/web/courses/PDFViewer/PDFEmbed'

interface PDFEmbedPageProps {
  searchParams: Promise<{
    url?: string
    title?: string
  }>
}

export default async function PDFEmbedPage({ searchParams }: PDFEmbedPageProps) {
  const params = await searchParams
  const pdfUrl = params.url || ''
  const title = params.title || 'Test PDF'

  return (
    <div className="min-h-screen bg-muted/30 p-section-sm">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-heading-xl font-bold mb-4">PDF Embed Test Page</h1>

        <div className="mb-4 p-card-padding bg-card rounded-lg shadow-elevation-1 border border-border">
          <h2 className="text-heading-md font-semibold mb-2">Test Parameters</h2>
          <ul className="text-body-sm space-y-1">
            <li>
              <span className="font-medium">URL:</span>{' '}
              <code className="bg-muted px-2 py-1 rounded text-body-xs">{pdfUrl || '(none)'}</code>
            </li>
            <li>
              <span className="font-medium">Title:</span>{' '}
              <code className="bg-muted px-2 py-1 rounded text-body-xs">{title}</code>
            </li>
          </ul>
        </div>

        {pdfUrl ? (
          <div className="bg-card rounded-lg shadow-elevation-1 border border-border overflow-hidden">
            <PDFEmbed pdfUrl={pdfUrl} title={title} />
          </div>
        ) : (
          <div className="p-section-sm bg-card rounded-lg shadow-elevation-1 border border-border text-center text-muted-foreground">
            No PDF URL provided. Add ?url=&lt;encoded_url&gt; to the URL.
          </div>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata({ searchParams }: PDFEmbedPageProps) {
  const params = await searchParams
  return {
    title: `PDF Embed Test - ${params.title || 'No Title'}`,
  }
}
