import type { Page } from '@/payload-types'
import type React from 'react'

import { getCachedDocument } from '@/infra/utils/getDocument'
import { getCachedRedirects } from '@/infra/utils/getRedirects'
import { notFound, redirect } from 'next/navigation'

interface Props {
  disableNotFound?: boolean
  url: string
}

/**
 * Normalize a path string for consistent matching.
 * Rules:
 * - Trim whitespace first
 * - If empty after trim → return '/'
 * - Strip query string and hash
 * - Ensure leading /
 * - Remove trailing slash (except /)
 */
export function normalizePath(input: string): string {
  let path = input.trim()

  // Empty after trim → root
  if (path.length === 0) {
    return '/'
  }

  // Strip query string
  const queryIndex = path.indexOf('?')
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex)
  }

  // Strip hash
  const hashIndex = path.indexOf('#')
  if (hashIndex !== -1) {
    path = path.slice(0, hashIndex)
  }

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path
  }

  // Remove trailing slash (except for root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  return path
}

/**
 * Check if a URL is an internal path (starts with / and not external).
 * Rules:
 * - Allow only internal paths starting with /
 * - Reject http://, https://, //, or empty strings
 */
export function isInternalPath(url: string): boolean {
  const trimmed = url?.trim()
  if (!trimmed || trimmed.length === 0) return false
  if (trimmed.startsWith('//')) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  return trimmed.startsWith('/')
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()()
  const normalizedUrl = normalizePath(url)

  const redirectItem = redirects.find((redirectItem) => {
    const fromNormalized = normalizePath(redirectItem.from || '')
    return fromNormalized === normalizedUrl
  })

  if (redirectItem) {
    // Handle direct URL redirects
    if (redirectItem.to?.url) {
      const targetUrl = redirectItem.to.url

      // Check if it's an internal path
      if (!isInternalPath(targetUrl)) {
        // Block external URLs - skip redirect
      } else {
        const targetNormalized = normalizePath(targetUrl)

        // Loop protection: skip redirect if target equals source
        if (targetNormalized === normalizedUrl) {
          // Loop detected - skip redirect
        } else {
          redirect(targetUrl)
        }
      }
    } else if (redirectItem.to?.reference) {
      let redirectUrl: string | undefined

      if (typeof redirectItem.to.reference.value === 'string') {
        const collection = redirectItem.to.reference.relationTo
        const id = redirectItem.to.reference.value

        const document = (await getCachedDocument(collection, id)()) as Page
        redirectUrl = `${redirectItem.to.reference.relationTo !== 'pages' ? `/${redirectItem.to.reference.relationTo}` : ''}/${
          document?.slug
        }`
      } else {
        redirectUrl = `${redirectItem.to.reference.relationTo !== 'pages' ? `/${redirectItem.to.reference.relationTo}` : ''}/${
          typeof redirectItem.to.reference.value === 'object'
            ? redirectItem.to.reference.value?.slug
            : ''
        }`
      }

      if (redirectUrl) {
        // Check if it's an internal path
        if (!isInternalPath(redirectUrl)) {
          // Block external URLs - skip redirect
        } else {
          const targetNormalized = normalizePath(redirectUrl)

          // Loop protection: skip redirect if target equals source
          if (targetNormalized === normalizedUrl) {
            // Loop detected - skip redirect
          } else {
            redirect(redirectUrl)
          }
        }
      }
    }
  }

  if (disableNotFound) return null

  notFound()
}
