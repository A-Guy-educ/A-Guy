/**
 * Normalize a URL to always include a scheme
 * Returns empty string for undefined/empty/whitespace input
 */
function normalizeUrl(url: string | undefined): string {
  if (!url || !url.trim()) {
    return ''
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  return url
}

export const getServerSideURL = () => {
  return (
    normalizeUrl(process.env.NEXT_PUBLIC_SERVER_URL || '') ||
    normalizeUrl(process.env.VERCEL_URL || '') ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')
  )
}

export const getClientSideURL = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ''
}
