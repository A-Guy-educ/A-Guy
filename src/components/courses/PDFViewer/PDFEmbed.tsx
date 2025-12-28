'use client'

interface PDFEmbedProps {
  pdfUrl: string
  title: string
}

export function PDFEmbed({ pdfUrl, title }: PDFEmbedProps) {
  const handleError = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const target = e.currentTarget
    target.style.display = 'none'
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-50">
      <iframe
        src={pdfUrl}
        title={`PDF: ${title}`}
        className="w-full"
        style={{ height: '800px' }}
        loading="lazy"
        onError={handleError}
      />
    </div>
  )
}
