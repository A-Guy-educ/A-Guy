import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'

export const getServerSideURL = () => {
  return (
    getConfigValue('NEXT_PUBLIC_SERVER_URL', { throwIfNotFound: false }) ||
    (getConfigValue('VERCEL_PROJECT_PRODUCTION_URL', { throwIfNotFound: false })
      ? `https://${getConfigValue('VERCEL_PROJECT_PRODUCTION_URL', { throwIfNotFound: false })}`
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

  if (getConfigValue('VERCEL_PROJECT_PRODUCTION_URL', { throwIfNotFound: false })) {
    return `https://${getConfigValue('VERCEL_PROJECT_PRODUCTION_URL', { throwIfNotFound: false })}`
  }

  return getConfigValue('NEXT_PUBLIC_SERVER_URL', { throwIfNotFound: false }) || ''
}
