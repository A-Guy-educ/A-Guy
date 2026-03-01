/**
 * @fileType hook
 * @domain cody
 * @pattern usePublish
 * @ai-summary Hook for publishing dev to production
 */
'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { publishApi } from '../api'

export function usePublish() {
  return useMutation({
    mutationFn: () => publishApi.publish(),
    onSuccess: () => {
      toast.success('Published to production')
    },
    onError: (error: Error) => {
      toast.error(`Publish failed: ${error.message}`)
    },
  })
}
