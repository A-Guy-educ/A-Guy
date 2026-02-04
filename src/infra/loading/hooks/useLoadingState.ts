'use client'

import { useSyncExternalStore, useCallback, useMemo } from 'react'
import { loadingManager } from '../LoadingManager'

type LoadingSelector = 'busy' | 'screen' | 'route' | { key: string }

/**
 * Hook to subscribe to specific loading states
 * Re-renders only when the specific condition changes
 */
export function useLoadingState(selector: LoadingSelector): boolean {
  // Memoize selector key to avoid recreating getSnapshot on every render
  const selectorKey = useMemo(() => {
    if (typeof selector === 'string') return selector
    return `key:${selector.key}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof selector === 'string' ? selector : (selector as { key: string }).key])

  const getSnapshot = useCallback(() => {
    if (selectorKey === 'busy') {
      return loadingManager.isBusy()
    }
    if (selectorKey === 'screen') {
      return loadingManager.isScreenBusy()
    }
    if (selectorKey === 'route') {
      return loadingManager.isRouteBusy()
    }
    if (selectorKey.startsWith('key:')) {
      const key = selectorKey.slice(4)
      return loadingManager.isKeyBusy(key)
    }
    return false
  }, [selectorKey])

  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(loadingManager.subscribe, getSnapshot, getServerSnapshot)
}
