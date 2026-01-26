import { getConfigValue } from '@/lib/config/runtime/bootstrap-config'
import * as Sentry from '@sentry/nextjs'

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

Sentry.init({
  dsn: getConfigValue('NEXT_PUBLIC_SENTRY_DSN', { throwIfNotFound: false }),

  // Replay sample rate for production
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Tracing
  tracesSampleRate: 0.1,

  // Environment
  environment: getConfigValue('NODE_ENV'),

  // Disable in development
  enabled: getConfigValue('NODE_ENV') === 'production',

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
