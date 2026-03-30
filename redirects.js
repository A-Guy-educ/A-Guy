/**
 * Extract Blob CDN base URL from env var or token.
 * Used at build time to bake media redirects into the routing config.
 */
function getBlobBaseUrl() {
  const explicit = process.env.BLOB_PUBLIC_BASE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return null
  const match = token.match(/^vercel_blob_rw_([a-z\d]+)_/i)
  if (!match) return null
  return `https://${match[1].toLowerCase()}.public.blob.vercel-storage.com`
}

const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const codyRedirect = {
    source: '/cody/:path*',
    destination: 'https://cody-aguy.vercel.app/cody/:path*',
    permanent: false,
  }

  const redirects = [internetExplorerRedirect, codyRedirect]

  // Media CDN redirects — serve files directly from Vercel Blob CDN
  // instead of proxying through serverless functions.
  // PDFs excluded (same-origin needed for PDF.js viewer).
  const blobBaseUrl = getBlobBaseUrl()
  if (blobBaseUrl) {
    // Redirect non-PDF media files to Blob CDN
    // The :filename pattern excludes .pdf files via regex
    redirects.push(
      {
        source: '/api/media/file/:filename(.*\\.(?!pdf$)[^.]+$)',
        destination: `${blobBaseUrl}/:filename`,
        permanent: false,
      },
      {
        source: '/api/exercise-assets/file/:filename(.*\\.(?!pdf$)[^.]+$)',
        destination: `${blobBaseUrl}/:filename`,
        permanent: false,
      },
    )
  }

  return redirects
}

export default redirects
