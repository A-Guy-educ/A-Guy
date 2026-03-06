/**
 * @fileType hook
 * @domain cody
 * @pattern usePRCIStatus
 * @ai-summary Hook to poll CI status for a PR using GitHub's mergeable_state
 */
'use client'

import { useQuery } from '@tanstack/react-query'
import { prsApi } from '../api'

export function usePRCIStatus(prNumber: number | undefined) {
  return useQuery({
    queryKey: ['pr-ci-status', prNumber],
    queryFn: () => prsApi.ciStatus(prNumber!),
    enabled: !!prNumber,
    // Poll every 10s while CI is running, stop when settled
    refetchInterval: (query) => {
      const status = query.state.data?.ciStatus
      if (status === 'running' || status === 'pending') return 10_000
      return false
    },
    staleTime: 5_000,
  })
}
