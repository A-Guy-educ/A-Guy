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
    <div className="border rounded-lg overflow-hidden bg-gray-50 relative">
      {/* Overlay to hide the top toolbar - covers approximately 40px from top */}
      <iframe
        src={pdfUrl}
        title={`PDF: ${title}`}
        className="w-full relative"
        style={{ height: '841px', marginTop: '-41px' }}
        loading="lazy"
        onError={handleError}
      />
    </div>
  )
}