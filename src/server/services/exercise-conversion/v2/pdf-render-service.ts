/**
 * V2 PDF Page Rendering Service
 *
 * Renders all PDF pages to PNG image buffers in a single pass.
 * Loads the PDF document once and renders each page sequentially.
 * Also exposes PDF page proxies for text extraction.
 *
 * @fileType service
 * @domain conversion
 * @pattern pdf-processing
 */

/**
 * Rendered page image with integer pixel dimensions.
 */
export interface PageImage {
  buffer: Buffer
  width: number
  height: number
}

/**
 * Full page data including rendered image and pdfjs page proxy.
 * The pdfPage can be used for text extraction via getTextContent().
 */
export interface PageData {
  image: PageImage
  pdfPage: any // PDFPageProxy from pdfjs-dist
}

/**
 * Load a PDF and render all pages, returning both images and page proxies.
 *
 * @param pdfBuffer - The full PDF file buffer
 * @returns Array of PageData for each page (0-indexed)
 */
export async function loadAndRenderAllPages(pdfBuffer: Buffer): Promise<PageData[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { createCanvas } = await import('@napi-rs/canvas')

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    enableXfa: false,
  })

  const pdf = await loadingTask.promise
  const pageCount = pdf.numPages
  const pages: PageData[] = []

  for (let i = 0; i < pageCount; i++) {
    const pdfPage = await pdf.getPage(i + 1) // pdfjs uses 1-based indexing
    const viewport = pdfPage.getViewport({ scale: 2.0 })
    const width = Math.floor(viewport.width)
    const height = Math.floor(viewport.height)

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D

    if (!ctx) {
      throw new Error(`Failed to get canvas context for page ${i}`)
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    await pdfPage.render({ canvasContext: ctx, viewport }).promise

    const buffer = Buffer.from(await canvas.encode('png'))
    pages.push({
      image: { buffer, width, height },
      pdfPage,
    })
  }

  return pages
}

/**
 * Render all pages of a PDF to PNG image buffers.
 * Convenience wrapper around loadAndRenderAllPages.
 *
 * @param pdfBuffer - The full PDF file buffer
 * @returns Array of PageImage for each page (0-indexed)
 */
export async function renderAllPages(pdfBuffer: Buffer): Promise<PageImage[]> {
  const pages = await loadAndRenderAllPages(pdfBuffer)
  return pages.map((p) => p.image)
}
