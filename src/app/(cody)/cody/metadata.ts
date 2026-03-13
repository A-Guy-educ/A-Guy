/**
 * @fileType utility
 * @domain cody
 * @pattern metadata-helper
 * @ai-summary Shared metadata builders for Cody dashboard routes with OG/Twitter tags
 */
import type { Metadata } from 'next'
import { fetchIssue } from '@/ui/cody/github-client'

const SITE_NAME = 'Cody Operations Dashboard'
const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'https://www.dev.aguy.co.il'

/** Build base metadata with OG + Twitter tags for static cody pages */
export function buildCodyMetadata(options: {
  title: string
  description: string
  path: string
}): Metadata {
  const { title, description, path } = options
  const url = `${BASE_URL}${path}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  }
}

/** Fetch issue and build dynamic metadata for /cody/[issueNumber] pages */
export async function buildTaskMetadata(
  issueNumber: number,
  options?: { suffix?: string; path?: string },
): Promise<Metadata> {
  const suffix = options?.suffix || ''
  const path = options?.path || `/cody/${issueNumber}`

  try {
    const issue = await fetchIssue(issueNumber)

    if (!issue) {
      return buildCodyMetadata({
        title: `Task #${issueNumber} — ${SITE_NAME}`,
        description: `Task #${issueNumber} not found`,
        path,
      })
    }

    // Clean title: remove [task-id] prefix brackets if present
    const cleanTitle = issue.title.replace(/^\[[^\]]*\]\s*/, '')

    // Build status from labels
    const statusLabels = issue.labels
      .filter((l) => l.name.startsWith('cody:'))
      .map((l) => l.name.replace('cody:', ''))
    const typeLabels = issue.labels
      .filter((l) => l.name.startsWith('type:'))
      .map((l) => l.name.replace('type:', ''))

    const statusText = statusLabels.length > 0 ? statusLabels[0] : issue.state
    const typeText = typeLabels.length > 0 ? typeLabels[0] : ''

    const title = `#${issueNumber} ${cleanTitle}${suffix ? ` — ${suffix}` : ''}`

    // Build a short description from type + status + first 120 chars of body
    const bodySnippet = issue.body
      ? issue.body
          .replace(/[#*_`>\-\[\]()]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120)
      : ''
    const descParts = [
      typeText && `${typeText.charAt(0).toUpperCase() + typeText.slice(1)}`,
      `Status: ${statusText}`,
      bodySnippet && bodySnippet + (bodySnippet.length >= 120 ? '…' : ''),
    ].filter(Boolean)
    const description = descParts.join(' · ')

    return buildCodyMetadata({ title, description, path })
  } catch {
    // If GitHub API fails, return basic metadata (don't block page render)
    return buildCodyMetadata({
      title: `Task #${issueNumber}${suffix ? ` — ${suffix}` : ''} — ${SITE_NAME}`,
      description: `View task #${issueNumber} on the Cody Operations Dashboard`,
      path,
    })
  }
}
