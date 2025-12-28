import { PDFEmbed } from './PDFEmbed'

interface PDFViewerProps {
  pdfUrl: string
  lessonTitle: string
}

export function PDFViewer({ pdfUrl, lessonTitle }: PDFViewerProps) {
  return <PDFEmbed pdfUrl={pdfUrl} title={lessonTitle} />
}
