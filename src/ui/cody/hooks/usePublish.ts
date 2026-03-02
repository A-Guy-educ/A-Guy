/**
 * @fileType hook
 * @domain cody
 * @pattern usePublish
 * @ai-summary Hook for publishing dev to production (creates issue with publish label)
 */
'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { publishApi } from '../api'

export function usePublish() {
  return useMutation({
    mutationFn: () => publishApi.publish(),
    onSuccess: (data) => {
      const response = data as { message?: string; issueUrl?: string; issueNumber?: number }
      if (response.issueUrl) {
        toast.success(response.message || `Publish issue #${response.issueNumber} created`, {
          action: {
            label: 'View Issue',
            onClick: () => window.open(response.issueUrl!, '_blank'),
          },
        })
      } else {
        toast.success(response.message || 'Publish initiated')
      }
    },
    onError: (error: Error) => {
      toast.error(`Publish failed: ${error.message}`)
    },
  })
}
