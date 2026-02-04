/**
 * Server Initialization
 *
 * Sets up lazy loading and other server-side initialization.
 * This file runs at module import time (server-side only).
 *
 * IMPORTANT: This file must NOT be imported from client code.
 * Use the check in infra/config/runtime/config-values.ts for server-side detection.
 */
import config from '@payload-config'
import { getPayload } from 'payload'

import {
  loadConfigValues,
  reloadConfigValues,
  setPayloadGetterForLazyLoading,
} from '@/infra/config/runtime'

const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Set up lazy loading for config values.
 * When config values are accessed before explicit loading,
 * this getter will create a Payload instance and load the config.
 */
setPayloadGetterForLazyLoading(async () => {
  const payload = await getPayload({ config })

  // In development, always reload to pick up config changes from DB
  // In production, use cached values for performance
  if (isDevelopment) {
    await reloadConfigValues(payload)
  } else {
    await loadConfigValues(payload)
  }

  return payload
})
