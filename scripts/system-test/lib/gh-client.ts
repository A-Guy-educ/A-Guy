/**
 * @fileType utility
 * @domain cody | system-test
 * @pattern github-client
 * @ai-summary GitHubClient wrapper for system test context
 */

import { createGitHubClient } from '../../inspector/clients/github'
import type { GitHubClient } from '../../inspector/core/types'

/**
 * Create a GitHubClient for the system test context.
 * Uses GH_TOKEN and GH_PAT from environment variables.
 */
export function createSystemTestClient(repo: string): GitHubClient {
  const token = process.env.GH_TOKEN
  const pat = process.env.GH_PAT

  if (!token) {
    throw new Error('GH_TOKEN environment variable is required')
  }

  return createGitHubClient(repo, token, pat)
}
