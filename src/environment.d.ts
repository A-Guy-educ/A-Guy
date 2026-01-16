declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      DATABASE_URL: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string

      // Analytics
      NEXT_PUBLIC_ANALYTICS_ENABLED?: string
      NEXT_PUBLIC_ANALYTICS_DEBUG?: string
      NEXT_PUBLIC_ANALYTICS_DRY_RUN?: string
      NEXT_PUBLIC_GA4_ENABLED?: string
      NEXT_PUBLIC_GA4_MEASUREMENT_ID?: string
      NEXT_PUBLIC_MIXPANEL_ENABLED?: string
      NEXT_PUBLIC_MIXPANEL_TOKEN?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
