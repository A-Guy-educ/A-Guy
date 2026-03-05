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
 *
 * Using unknown for PDFPageProxy as pdfjs-dist types are complex to import
 * and this type is only used internally for method access.
 */
export interface PageData {
  image: PageImage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any
}

interface PdfJsLike {
  GlobalWorkerOptions: {
    workerSrc: string
  }
  getDocument: (input: unknown) => {
    promise: Promise<{
      numPages: number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getPage: (pageNumber: number) => Promise<any>
    }>
  }
}

interface PdfJsWorkerModule {
  WorkerMessageHandler: unknown
}

type GlobalWithPdfJsWorker = typeof globalThis & {
  pdfjsWorker?: PdfJsWorkerModule
}

let workerBootstrap: Promise<void> | null = null

async function ensurePdfJsWorkerRegistered(): Promise<void> {
  if (!workerBootstrap) {
    workerBootstrap = (async () => {
      const workerModulePath = 'pdfjs-dist/legacy/build/pdf.worker.mjs'
      const workerModule = (await import(workerModulePath)) as PdfJsWorkerModule
      const globalWithWorker = globalThis as GlobalWithPdfJsWorker

      globalWithWorker.pdfjsWorker = {
        WorkerMessageHandler: workerModule.WorkerMessageHandler,
      }
    })()
  }

  await workerBootstrap
}

/**
 * Load a PDF and render all pages, returning both images and page proxies.
 *
 * @param pdfBuffer - The full PDF file buffer
 * @returns Array of PageData for each page (0-indexed)
 */
export async function loadAndRenderAllPages(pdfBuffer: Buffer): Promise<PageData[]> {
  const pdfjsLib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsLike
  const { createCanvas } = await import('@napi-rs/canvas')

  // Register WorkerMessageHandler on globalThis so PDF.js fake-worker setup does not
  // rely on runtime dynamic import paths that can break in Vercel serverless bundles.
  await ensurePdfJsWorkerRegistered()

  // Keep workerSrc as a package specifier fallback for environments that still need it.
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs'

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
