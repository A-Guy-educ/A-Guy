/**
 * @fileType hook
 * @domain cody
 * @pattern usePublish
 * @ai-summary Hook for publishing dev to production (creates PR + approves)
 */
'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { publishApi } from '../api'

export function usePublish() {
  return useMutation({
    mutationFn: () => publishApi.publish(),
    onSuccess: (data) => {
      const response = data as { message?: string; prUrl?: string; prNumber?: number }
      if (response.prUrl) {
        toast.success(`PR #${response.prNumber} created and approved`, {
          action: {
            label: 'View PR',
            onClick: () => window.open(response.prUrl!, '_blank'),
          },
        })
      } else {
        toast.success(response.message || 'Published to production')
      }
    },
    onError: (error: Error) => {
      toast.error(`Publish failed: ${error.message}`)
    },
  })
}
