/**
 * @fileType utility
 * @domain infra
 * @pattern url-resolution
 * @ai-summary Environment-aware URL resolver: falls back to localhost in development, Vercel prod URL in production.
 *
 * Using localhost in production deployments will cause CORS failures and incorrect OG-meta URLs;
 * ensure NEXT_PUBLIC_SERVER_URL is set in all non-dev environments.
 */

export const getServerSideURL = () => {
  return (
    process.env.NEXT_PUBLIC_SERVER_URL ||
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
